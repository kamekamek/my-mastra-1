import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow } from './workflows';
import { 
  weatherAgent, 
  gmailAgent, 
  spreadSheetAgent, 
  calendarAgent 
} from './agents';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
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

// エージェントとヘルパー関数をエクスポート
export { 
  weatherAgent, 
  gmailAgent, 
  generateWithGmail, 
  streamWithGmail,
  spreadSheetAgent, 
  generateWithSheets, 
  streamWithSheets,
  calendarAgent,
  generateWithCalendar, 
  streamWithCalendar 
} from './agents';
