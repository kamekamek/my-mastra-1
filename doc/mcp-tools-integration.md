# MCPツール統合ガイド

このドキュメントでは、Mastraアプリケーションに様々なMCPサーバーを統合し、各エージェントが特定のツールセットのみにアクセスできるようにする汎用的な実装方法を説明します。

## MCPとは

Model Context Protocol (MCP) は、言語モデルとツールを連携させるための標準化されたプロトコルです。MCPを使うことで、さまざまなサービスやAPIをMastraエージェントから簡単に利用できるようになります。

MCPサーバーの主な種類：
1. **Composio.devレジストリのサーバー** - 事前構築されたツールを簡単に利用できるホスティングされたサービス
2. **標準入出力（stdin/stdout）ベースのサーバー** - ローカルで実行される軽量なプロセス
3. **Docker化されたMCPサーバー** - コンテナ化されたMCPサーバー
4. **SSEベースのサーバー** - Server-Sent Eventsを使用したWebサーバー

## 1. MCPの設定

### 1.1 Composio.devレジストリのサーバーを使用

```typescript
// mcp/index.ts
import { MCPConfiguration } from "@mastra/mcp";

export const mcp = new MCPConfiguration({
  id: "your-app-id",
  servers: {
    gmail: {
      url: new URL("https://mcp.composio.dev/gmail/your-client-id")
    },
    googleSheets: {
      url: new URL("https://mcp.composio.dev/googlesheets/your-client-id")
    }
  },
});
```

### 1.2 ローカルプロセスやDockerのMCPサーバーを使用

```typescript
// mcp/index.ts
import { MCPConfiguration } from "@mastra/mcp";

export const mcp = new MCPConfiguration({
  id: "your-app-id",
  servers: {
    // ローカルプロセスを使用するサーバー
    weather: {
      command: "node",
      args: ["./local-mcp-servers/weather-server.js"],
      env: {
        API_KEY: process.env.WEATHER_API_KEY
      }
    },
    // Dockerコンテナを使用するサーバー
    fetch: {
      command: "docker",
      args: ["run", "-i", "--rm", "mcp/fetch"],
    },
    // SSEベースのサーバー
    database: {
      url: new URL("http://localhost:3000/mcp/db"),
      requestInit: {
        headers: {
          Authorization: `Bearer ${process.env.DB_API_TOKEN}`
        }
      }
    }
  },
});
```

## 2. ツールセットヘルパー関数の作成

MCPサーバーからツールを利用するには、以下の2つの方法があります：

### 2.1 `getTools()`メソッドを使用（全ツールを一括取得）

全てのサーバーのツールを一括で取得し、エージェント定義時に設定します：

```typescript
const agent = new Agent({
  name: 'Multi-tool Agent',
  instructions: `You have access to all the MCP tools.`,
  model: openai('gpt-4o'),
  tools: await mcp.getTools(), // 全てのサーバーからツールを取得
});
```

### 2.2 `getToolsets()`メソッドと特定ツールセット選択用のヘルパー関数

特定のサービスのツールセットのみを取得するためのヘルパー関数を作成します：

```typescript
// mcp/index.ts に追加
export async function getGmailTools() {
  const toolsets = await mcp.getToolsets();
  return { gmail: toolsets.gmail };
}

export async function getSheetsTools() {
  const toolsets = await mcp.getToolsets();
  return { googleSheets: toolsets.googleSheets };
}

export async function getWeatherTools() {
  const toolsets = await mcp.getToolsets();
  return { weather: toolsets.weather };
}
```

## 3. 専用エージェントの実装

エージェントを実装する方法には複数のアプローチがあります：

### 3.1 単一サービス専用エージェント

特定のサービスのツールのみを使用するエージェントを実装します：

```typescript
// agents/gmailAgent.ts
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { getGmailTools } from '../mcp';

export const gmailAgent = new Agent({
  name: 'Gmail Agent',
  instructions: `あなたはGmailの操作を支援するアシスタントです。
以下のような操作をサポートします：
- メールを送信する（GMAIL_SEND_EMAIL）
- メールを検索する（GMAIL_FETCH_EMAILS）
...`,
  model: openai('gpt-4o'),
  memory: new Memory(),
});

// ツールセットを指定してエージェントを使用するヘルパー関数
export async function generateWithGmail(input: string) {
  return gmailAgent.generate(input, {
    toolsets: await getGmailTools()
  });
}

export async function streamWithGmail(input: string) {
  return gmailAgent.stream(input, {
    toolsets: await getGmailTools()
  });
}
```

### 3.2 マルチサービス対応の汎用エージェント

複数のサービスのツールを動的に選択して使用するエージェントを実装します：

```typescript
// agents/multiServiceAgent.ts
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { getGmailTools, getSheetsTools, getWeatherTools } from '../mcp';

export const multiServiceAgent = new Agent({
  name: 'Multi-Service Agent',
  instructions: `あなたは複数のサービスを操作できるアシスタントです。
ユーザーの要求に応じて適切なサービスのツールを選択して使用してください。`,
  model: openai('gpt-4o'),
  memory: new Memory(),
});

// 特定サービスのみ使用
export async function generateWithGmail(input: string) {
  return multiServiceAgent.generate(input, {
    toolsets: await getGmailTools()
  });
}

// 複数サービスを組み合わせて使用
export async function generateWithGmailAndSheets(input: string) {
  const gmailTools = await getGmailTools();
  const sheetsTools = await getSheetsTools();
  
  return multiServiceAgent.generate(input, {
    toolsets: { ...gmailTools, ...sheetsTools }
  });
}

// 全サービスを使用
export async function generateWithAllServices(input: string) {
  return multiServiceAgent.generate(input, {
    toolsets: await mcp.getToolsets()
  });
}
```

## 4. エージェントモジュールのエクスポート

全てのエージェントとそのヘルパー関数を`agents/index.ts`からエクスポートします。

```typescript
// agents/index.ts
export { gmailAgent, generateWithGmail, streamWithGmail } from './gmailAgent';
export { sheetsAgent, generateWithSheets, streamWithSheets } from './sheetsAgent';
export { multiServiceAgent, generateWithAllServices } from './multiServiceAgent';
// 他のエージェントも同様にエクスポート
```

## 5. Mastraインスタンスの設定

メインの`index.ts`で、Mastraインスタンスを設定し、全てのエージェントを登録します。

```typescript
// index.ts
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { 
  gmailAgent, 
  sheetsAgent,
  multiServiceAgent,
  // 他のエージェント 
} from './agents';

export const mastra = new Mastra({
  workflows: { /* ワークフローがあれば設定 */ },
  agents: { 
    gmailAgent, 
    sheetsAgent,
    multiServiceAgent,
    // 他のエージェント
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

// エージェントとヘルパー関数を再エクスポート
export { 
  gmailAgent, 
  generateWithGmail, 
  streamWithGmail,
  sheetsAgent, 
  generateWithSheets, 
  streamWithSheets,
  multiServiceAgent,
  generateWithAllServices,
  // 他のエージェントとヘルパー関数
} from './agents';
```

## 6. 使用方法

エージェントは以下のように使用します：

```typescript
import { generateWithGmail, generateWithAllServices } from './path-to-your-mastra';

// 単一サービス（Gmail）のみを使用する例
const gmailResponse = await generateWithGmail("最新のメールを3件取得して");

// 複数サービスを使用する例
const multiServiceResponse = await generateWithAllServices(
  "最新のメールを確認して、その内容をスプレッドシートにまとめて"
);
```

## 7. MCPClientの直接使用

特殊なケースでは、`MCPConfiguration`を使わずに`MastraMCPClient`を直接使用することもできます：

```typescript
import { Agent } from "@mastra/core/agent";
import { MastraMCPClient } from "@mastra/mcp";
import { openai } from "@ai-sdk/openai";

async function runWithFetchClient() {
  // Docker化されたMCPサーバーに接続
  const fetchClient = new MastraMCPClient({
    name: "fetch",
    server: {
      command: "docker",
      args: ["run", "-i", "--rm", "mcp/fetch"],
    },
  });

  // エージェント作成
  const agent = new Agent({
    name: "Fetch Agent",
    instructions: "You can fetch data from URLs on demand.",
    model: openai("gpt-4o-mini"),
  });

  try {
    // MCPサーバーに接続
    await fetchClient.connect();
    
    // プロセス終了時のクリーンアップ
    process.on("exit", () => {
      fetchClient.disconnect();
    });

    // ツールを取得
    const tools = await fetchClient.tools();

    // エージェントにツールを渡して実行
    const response = await agent.generate(
      "Tell me about mastra.ai/docs",
      {
        toolsets: {
          fetch: tools,
        },
      },
    );

    console.log(response.text);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // 終了時に必ず切断
    await fetchClient.disconnect();
  }
}

runWithFetchClient();
```

## 8. 注意点

1. **エージェントの命令文**: 各エージェントの命令文（instructions）は、そのエージェントが使用するツールに合わせて設定してください。

2. **メモリの分離**: 各エージェントは独自のメモリインスタンスを持ちます。複数のサービスを組み合わせる場合は記憶の文脈に注意してください。

3. **認証処理**: 多くのMCPサービスは初回使用時にOAuth認証が必要です。認証フローをエージェントの命令文に含めることで、ユーザーへの案内がスムーズになります。

4. **リソース管理**: MCPサーバー接続はシステムリソースを消費します。使用しなくなったインスタンスは`await mcp.disconnect()`で切断してください。

5. **エラーハンドリング**: ツール呼び出しでエラーが発生した場合は、わかりやすいエラーメッセージをユーザーに提供してください。

6. **バックグラウンドプロセス**: `command`と`args`を使用するMCPサーバーはバックグラウンドプロセスとして実行されます。アプリケーション終了時に適切に終了する仕組みを実装してください。

## 9. 拡張方法

新しいMCPサーバーを追加する場合は、以下の手順を実行してください：

1. `mcp/index.ts`のサーバー定義に新しいサービスを追加
2. 新しいサービス用のツールセット取得関数を作成
3. 新しいサービス用のエージェントとヘルパー関数を実装
4. `agents/index.ts`と`index.ts`を更新して新しいエージェントとヘルパー関数をエクスポート

## 10. MCPサーバー作成リソース

独自のMCPサーバーを作成する場合は、以下のリソースが参考になります：

- [Model Context Protocol公式リポジトリ](https://github.com/modelcontextprotocol/typescript-sdk)
- [Docker MCPサーバーの例](https://github.com/docker/mcp-servers)
- [MCP Protocol仕様](https://github.com/model-context/protocol)

この方法により、各エージェントは担当するサービスのツールのみにアクセスでき、責任の明確な分離が実現できます。また、必要に応じて複数のサービスを組み合わせた高度な機能も簡単に実装できます。 