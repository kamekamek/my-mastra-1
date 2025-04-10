import { MCPConfiguration } from "@mastra/mcp";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
 
// Gmailサーバー用のMCPConfiguration
export const gmailMCP = new MCPConfiguration({
    id: "gmail-mcp",
    servers: {
        gmail: {
            url: new URL("https://mcp.composio.dev/gmail/scarce-fierce-cartoon-Us6j5M")
        }
    },
});

// Google Sheetsサーバー用のMCPConfiguration
export const sheetsMCP = new MCPConfiguration({
    id: "sheets-mcp",
    servers: {
        googleSheets: {
            url: new URL("https://mcp.composio.dev/googlesheets/fierce-abundant-autumn-Nu1VUd")
        }
    },
});

// Google Calendarサーバー用のMCPConfiguration
export const calendarMCP = new MCPConfiguration({
    id: "calendar-mcp",
    servers: {
        googleCalendar: {
            url: new URL("https://mcp.composio.dev/googlecalendar/scarce-fierce-cartoon-Us6j5M")
        }
    },
});

// プロセス終了時のクリーンアップ関数
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