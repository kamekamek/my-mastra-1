# MCPツール統合ガイド

このドキュメントでは、Mastraアプリケーションに様々なMCPサーバーを統合し、異なる役割を持つエージェントを効果的に実装する方法を説明します。パフォーマンスとリソース管理の観点から、各サービスごとに独立したMCPConfiguration インスタンスを使用する方法を推奨します。

## MCPとは

Model Context Protocol (MCP) は、言語モデルとツールを連携させるための標準化されたプロトコルです。MCPを使うことで、さまざまなサービスやAPIをMastraエージェントから簡単に利用できるようになります。

MCPサーバーの主な種類：
1. **Composio.devレジストリのサーバー** - 事前構築されたツールを簡単に利用できるホスティングされたサービス
2. **標準入出力（stdin/stdout）ベースのサーバー** - ローカルで実行される軽量なプロセス
3. **Docker化されたMCPサーバー** - コンテナ化されたMCPサーバー
4. **SSEベースのサーバー** - Server-Sent Eventsを使用したWebサーバー

## 1. サービスごとのMCP設定

### 1.1 各サービス専用のMCPConfigurationを作成

リソース競合とエラーを防ぐため、各サービスに個別のMCPConfigurationインスタンスを作成します。必ず一意のIDを指定してください。

```typescript
// mcp/index.ts
import { MCPConfiguration } from "@mastra/mcp";

// Gmailサーバー用のMCPConfiguration
export const gmailMCP = new MCPConfiguration({
  id: "gmail-mcp", // 一意のIDを指定
  servers: {
    gmail: {
      url: new URL("https://mcp.composio.dev/gmail/your-client-id")
    }
  },
});

// Google Sheetsサーバー用のMCPConfiguration
export const sheetsMCP = new MCPConfiguration({
  id: "sheets-mcp", // 一意のIDを指定
  servers: {
    googleSheets: {
      url: new URL("https://mcp.composio.dev/googlesheets/your-client-id")
    }
  },
});

// Google Calendarサーバー用のMCPConfiguration
export const calendarMCP = new MCPConfiguration({
  id: "calendar-mcp", // 一意のIDを指定
  servers: {
    googleCalendar: {
      url: new URL("https://mcp.composio.dev/googlecalendar/your-client-id")
    }
  },
});
```

### 1.2 プロセス終了時のクリーンアップ

リソースを適切に解放するために、プロセス終了時にすべてのMCP接続を切断する処理を追加します。

```typescript
// mcp/index.ts に追加
// クリーンアップ用のヘルパー関数
export async function disconnectAllMCP() {
  await Promise.all([
    gmailMCP.disconnect(),
    sheetsMCP.disconnect(),
    calendarMCP.disconnect()
  ]);
}

// プロセス終了時のクリーンアップを設定
process.on('exit', () => {
  disconnectAllMCP().catch(console.error);
});

// 予期しない終了時のクリーンアップを設定
process.on('SIGINT', async () => {
  await disconnectAllMCP();
  process.exit(0);
});
```

## 2. 役割に特化したエージェントの実装

各エージェントは自身のサービスに対応するMCPConfigurationからツールを取得します。

```typescript
// agents/gmailAgent.ts
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { gmailMCP } from '../mcp';

export const gmailAgent = new Agent({
  name: 'Gmail Agent',
  instructions: `あなたはGmailの操作を支援するアシスタントです。
以下のような操作をサポートします：
- メールを送信する（GMAIL_SEND_EMAIL）
...`,
  model: openai('gpt-4o'),
  tools: await gmailMCP.getTools(), // Gmailサービス専用のツールのみを使用
  memory: new Memory(),
});
```

同様に、他のサービス向けのエージェントも実装します：

```typescript
// agents/spreadSheetAgent.ts
export const spreadSheetAgent = new Agent({
  name: 'SpreadSheet Agent',
  instructions: `あなたはGoogle Sheetsの操作を支援するアシスタントです。...`,
  model: openai('gpt-4o'),
  tools: await sheetsMCP.getTools(), // Sheetsサービス専用のツールのみを使用
  memory: new Memory(),
});

// agents/calendarAgent.ts
export const calendarAgent = new Agent({
  name: 'Calendar Agent',
  instructions: `あなたはGoogle Calendarの操作を支援するアシスタントです。...`,
  model: openai('gpt-4o'),
  tools: await calendarMCP.getTools(), // Calendarサービス専用のツールのみを使用
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

1. **リソース競合の回避**: サービスごとに個別のMCPConfigurationを使用することで、リソース競合やミューテックスエラーを防止できます。

2. **効率的なリソース管理**: 各エージェントは必要なサービスのみに接続するため、リソース使用量が最適化されます。

3. **エラーの分離**: あるサービスで問題が発生しても、他のサービスには影響しません。

4. **清潔なコード構造**: 各サービスとそのツールが明確に分離され、保守性が向上します。

5. **パフォーマンスの向上**: 不要なツールの読み込みを避けることで、エージェントのパフォーマンスが向上します。

## 8. 注意点

1. **一意のID**: 各MCPConfigurationインスタンスには必ず一意のIDを設定してください。これはメモリリークを防ぐため重要です。

2. **リソースの解放**: プロセス終了時には必ずすべてのMCP接続を切断してください。そのためのクリーンアップコードを実装することをお勧めします。

3. **エラーハンドリング**: MCP接続のエラーを適切に処理するコードを実装してください。

4. **認証フロー**: 各サービスの初回使用時には認証が必要です。認証フローの説明をエージェントの命令文に含めることで、ユーザー体験が向上します。

5. **OAuth認証のユーザー体験向上**: 初回認証時のOAuth URLを新しいタブやポップアップで開くには、エージェントの命令文で以下のような案内を含めるようにしてください：
   ```
   認証URLが表示されたら、以下のように新しいタブで開くようにユーザーに案内してください：
   1. 認証URLが返されたら、「こちらの認証URLをクリックして新しいタブで開いてください: <認証URL>」と案内する
   2. ユーザーにはリンクをクリックしてもらい、新しいタブでOAuth認証を完了してもらう
   3. 「window.open('認証URL', '_blank')」を使って新しいタブで開く方法も案内する
   ```
   これにより、ユーザーはメインの会話を失うことなく認証を完了できます。

## 9. サービス追加方法

新しいMCPサービスを追加する場合は、以下の手順を実行してください：

1. `mcp/index.ts`に新しいサービス用のMCPConfigurationを追加
2. 新しいサービス専用のエージェントを実装
3. `agents/index.ts`と`index.ts`を更新して新しいエージェントをエクスポート
4. `disconnectAllMCP`関数に新しいMCP接続の切断処理を追加

## 10. MCPサーバー作成リソース

独自のMCPサーバーを作成する場合は、以下のリソースが参考になります：

- [Model Context Protocol公式リポジトリ](https://github.com/modelcontextprotocol/typescript-sdk)
- [Docker MCPサーバーの例](https://github.com/docker/mcp-servers)
- [MCP Protocol仕様](https://github.com/model-context/protocol)

このアプローチにより、各エージェントは特定のサービスに集中でき、リソース管理も最適化され、ミューテックスエラー（`mutex lock failed: Invalid argument`）などの問題を防止できます。 