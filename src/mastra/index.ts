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

// エージェントをエクスポート
export { 
  weatherAgent, 
  gmailAgent, 
  spreadSheetAgent, 
  calendarAgent 
} from './agents';
