import { MCPConfiguration } from "@mastra/mcp";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
 
const mcp = new MCPConfiguration({
    id: "sample",
    servers: {
        gmail: {
            url: new URL("https://mcp.composio.dev/gmail/[private-url-path]")
        },
        googleSheets: {
            url: new URL("https://mcp.composio.dev/googlesheets/fierce-abundant-autumn-Nu1VUd")
        }
    },
});