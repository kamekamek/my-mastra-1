import { MCPConfiguration } from "@mastra/mcp";

export const chatbotMCP = new MCPConfiguration({
    id: "chatbot-mcp",
    servers: {
        chatbot: {
            url: new URL("https://mcp.composio.dev/chatbot/advanced-chatbot-service")
        }
    },
});

export async function disconnectChatbotMCP() {
    await chatbotMCP.disconnect();
}
