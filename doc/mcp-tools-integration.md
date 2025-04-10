# MCPツール統合ガイド

このドキュメントでは、Mastraアプリケーションに様々なMCPサーバーを統合し、異なる役割を持つエージェントを効果的に実装する方法を説明します。

## MCPとは

Model Context Protocol (MCP) は、言語モデルとツールを連携させるための標準化されたプロトコルです。MCPを使うことで、さまざまなサービスやAPIをMastraエージェントから簡単に利用できるようになります。

MCPサーバーの主な種類：
1. **Composio.devレジストリのサーバー** - 事前構築されたツールを簡単に利用できるホスティングされたサービス
2. **標準入出力（stdin/stdout）ベースのサーバー** - ローカルで実行される軽量なプロセス
3. **Docker化されたMCPサーバー** - コンテナ化されたMCPサーバー
4. **SSEベースのサーバー** - Server-Sent Eventsを使用したWebサーバー

## 1. MCPの設定

### 1.1 Composio.devレジストリのサーバーを使用

複数のMCPサーバーを一つの`MCPConfiguration`オブジェクトで管理します。

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
    },
    googleCalendar: {
      url: new URL("https://mcp.composio.dev/googlecalendar/your-client-id")
    }
  },
});
```

### 1.2 ローカルプロセスやDockerのMCPサーバーも併用する場合

```typescript
// mcp/index.ts
import { MCPConfiguration } from "@mastra/mcp";

export const mcp = new MCPConfiguration({
  id: "your-app-id",
  servers: {
    // Composio.devレジストリのサーバー
    gmail: {
      url: new URL("https://mcp.composio.dev/gmail/your-client-id")
    },
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
    }
  },
});
```

## 2. 役割に特化したエージェントの実装

各エージェントは全てのMCPツールにアクセスできますが、**命令文（instructions）で特定のサービスに特化**した役割を明確にします。これにより、エージェントは適切なツールのみを使用するように導かれます。

```typescript
// agents/gmailAgent.ts
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { mcp } from '../mcp';

export const gmailAgent = new Agent({
  name: 'Gmail Agent',
  instructions: `あなたはGmailの操作を支援するアシスタントです。
以下のような操作をサポートします：
- メールを送信する（GMAIL_SEND_EMAIL）
- メールを検索する（GMAIL_FETCH_EMAILS）
...

ユーザーからの依頼に対して、必ずGmailツールを使って対応してください。
他のサービスのツールは使用せず、Gmailの操作に集中してください。`,
  model: openai('gpt-4o'),
  tools: await mcp.getTools(), // 全てのツールにアクセスできるが、命令文で制限
  memory: new Memory(),
});
```

同様に、他のサービス向けのエージェントも実装します：

```typescript
// agents/spreadSheetAgent.ts
export const spreadSheetAgent = new Agent({
  name: 'SpreadSheet Agent',
  instructions: `あなたはGoogle Sheetsの操作を支援するアシスタントです。
以下のような操作をサポートします：
- スプレッドシートの情報を取得する（GOOGLESHEETS_GET_SPREADSHEET_INFO）
...

ユーザーからの依頼に対して、必ずGoogle Sheetsツールを使って対応してください。
他のサービスのツールは使用せず、スプレッドシートの操作に集中してください。`,
  model: openai('gpt-4o'),
  tools: await mcp.getTools(), // 全てのツールにアクセスできるが、命令文で制限
  memory: new Memory(),
});
```

## 3. エージェントモジュールのエクスポート

各エージェントをまとめて簡単にインポート・エクスポートできるようにします。

```typescript
// agents/index.ts
// 必要なら既存のエージェントをインポート
import { weatherAgent } from './weatherAgent';

// 各サービス専用エージェントをエクスポート
export { gmailAgent } from './gmailAgent';
export { spreadSheetAgent } from './spreadSheetAgent';
export { calendarAgent } from './calendarAgent';
export { weatherAgent };
```

## 4. Mastraインスタンスの設定

メインの`index.ts`で、Mastraインスタンスを設定し、全てのエージェントを登録します。

```typescript
// index.ts
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { 
  weatherAgent, 
  gmailAgent, 
  spreadSheetAgent, 
  calendarAgent 
} from './agents';

export const mastra = new Mastra({
  workflows: { /* ワークフローがあれば設定 */ },
  agents: { 
    weatherAgent, 
    gmailAgent, 
    spreadSheetAgent, 
    calendarAgent 
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

// 他のファイルから使えるようにエージェントを再エクスポート
export { 
  weatherAgent, 
  gmailAgent, 
  spreadSheetAgent, 
  calendarAgent 
} from './agents';
```

## 5. 使用方法

エージェントは以下のように使用します：

```typescript
import { gmailAgent, spreadSheetAgent } from './path-to-your-mastra';

// Gmailエージェントを使用
const gmailResponse = await gmailAgent.generate("最新のメールを3件取得して");

// スプレッドシートエージェントを使用
const sheetsResponse = await spreadSheetAgent.generate("シートAの売上データを集計して");
```

## 6. 命令文（instructions）設計のポイント

各エージェントに全てのツールへのアクセスを許可しながらも、特定のサービスに集中させるための命令文設計ポイント：

1. **明確な役割定義**：エージェントの役割と使用すべきツールのセットを冒頭で明確に定義

2. **特定ツールの詳細説明**：対象サービスのツールについて詳細に説明し、他のツールには触れない

3. **禁止事項の明示**：「他のサービスのツールは使用しないでください」と明示的に指示

4. **典型的なユースケース**：そのサービスの代表的な使用例を示して理解を深める

5. **認証フローの説明**：特定のサービスの認証手順を詳細に説明

## 7. このアプローチの利点

1. **シンプルな実装**：各エージェントが同じMCPインスタンスとツールセットを共有できるため、実装がシンプル

2. **柔軟性**：新しいツールが追加された場合、エージェントの更新が容易で自動的に利用可能に

3. **コード効率**：ツールセットの複製や分離が不要で、メモリ効率が良い

4. **LLMの理解力活用**：言語モデルの文脈理解能力を活用して適切なツール選択を促進

## 8. 注意点

1. **エージェントの命令文設計**：各エージェントの命令文（instructions）は、そのエージェントの役割に合わせて丁寧に設計することが重要です。

2. **メモリの分離**：各エージェントは独自のメモリインスタンスを持ち、会話の履歴は各サービス内で独立して管理されます。

3. **認証処理**：多くのMCPサービスは初回使用時にOAuth認証が必要です。認証フローをエージェントの命令文に含めることで、ユーザーへの案内がスムーズになります。

4. **エラーハンドリング**：ツール呼び出しでエラーが発生した場合は、わかりやすいエラーメッセージをユーザーに提供してください。

## 9. 拡張方法

新しいMCPサーバーを追加する場合は、以下の手順を実行してください：

1. `mcp/index.ts`のサーバー定義に新しいサービスを追加
2. 新しいサービス専用のエージェントを実装（命令文で役割を明確に）
3. `agents/index.ts`と`index.ts`を更新して新しいエージェントをエクスポート

## 10. 代替アプローチ: ツールセットの制限

もし厳密にツールセットを制限したい場合は、`getToolsets()`メソッドと`generate()`/`stream()`の`toolsets`パラメータを使用する方法もあります：

```typescript
// より厳密なツールセット制限を行いたい場合の例
const allToolsets = await mcp.getToolsets();
const gmailOnlyResponse = await agent.generate("クエリ", {
  toolsets: { gmail: allToolsets.gmail }
});
```

ただし、このアプローチは追加の実装複雑性を導入するため、通常は命令文による制御で十分です。

## 11. MCPサーバー作成リソース

独自のMCPサーバーを作成する場合は、以下のリソースが参考になります：

- [Model Context Protocol公式リポジトリ](https://github.com/modelcontextprotocol/typescript-sdk)
- [Docker MCPサーバーの例](https://github.com/docker/mcp-servers)
- [MCP Protocol仕様](https://github.com/model-context/protocol)

この方法により、各エージェントは命令文を通じて特定の役割に集中し、Mastraアプリケーションの可読性と保守性が向上します。 