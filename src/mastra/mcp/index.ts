import { MCPConfiguration } from "@mastra/mcp";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
 
export const mcp = new MCPConfiguration({
    id: "sample",
    servers: {
        gmail: {
            url: new URL("https://mcp.composio.dev/gmail/scarce-fierce-cartoon-Us6j5M")
        },
        googleSheets: {
            url: new URL("https://mcp.composio.dev/googlesheets/fierce-abundant-autumn-Nu1VUd")
        },
        googleCalendar: {
            url: new URL("https://mcp.composio.dev/googlecalendar/scarce-fierce-cartoon-Us6j5M")
        }
    },
});

// 特定のサーバーのツールセットのみを取得するヘルパー関数
export async function getGmailTools() {
    const toolsets = await mcp.getToolsets();
    return { gmail: toolsets.gmail };
}

export async function getSheetsTools() {
    const toolsets = await mcp.getToolsets();
    return { googleSheets: toolsets.googleSheets };
}

export async function getCalendarTools() {
    const toolsets = await mcp.getToolsets();
    return { googleCalendar: toolsets.googleCalendar };
}