import { InboxSource } from '../inbox.constants';

export type InboxItemDto = {
  id: number;
  source: InboxSource;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

export type InboxMineDto = {
  unreadCount: number;
  items: InboxItemDto[];
};
