export interface CopilotChatRequest {
  ticket_id?: string;
  deal_id?: string;
  user_message: string;
  context?: Record<string, any>;
}

export interface CopilotChatResponse {
  reply: string;
  action_executed?: {
    action: string;
    details: Record<string, any>;
  };
  suggested_actions?: Array<{
    label: string;
    action: string;
    payload: Record<string, any>;
  }>;
}

export interface ILlmService {
  processChat(request: CopilotChatRequest, systemContext: any): Promise<CopilotChatResponse>;
}
