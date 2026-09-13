import { apiClient } from "./client";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  targetId: string | null;
  publishedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string | null;
  body: string;
  readAt: string | null;
  sentAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  channel: string;
  readAt: string | null;
  sentAt: string;
}

export async function listAnnouncements() {
  const { data } = await apiClient.get<{ announcements: Announcement[] }>("/announcements");
  return data.announcements;
}

export async function createAnnouncement(input: { title: string; body: string; audience: string; targetId?: string }) {
  const { data } = await apiClient.post<Announcement & { reach: number }>("/announcements", input);
  return data;
}

export async function listInbox() {
  const { data } = await apiClient.get<{ messages: Message[] }>("/messages/inbox");
  return data.messages;
}

export async function sendMessage(input: { recipientId: string; subject?: string; body: string }) {
  const { data } = await apiClient.post<Message>("/messages", input);
  return data;
}

export async function markMessageRead(id: string) {
  await apiClient.patch(`/messages/${id}/read`);
}

export async function fetchMyNotifications() {
  const { data } = await apiClient.get<{ notifications: Notification[]; unreadCount: number }>("/notifications/mine");
  return data;
}

export async function markNotificationRead(id: string) {
  await apiClient.patch(`/notifications/${id}/read`);
}
