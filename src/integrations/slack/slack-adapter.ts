export type SlackExternalResult = {
  externalId: string;
};

export interface SlackAdapter {
  sendMessage(channel: string, message: string): Promise<SlackExternalResult>;
}
