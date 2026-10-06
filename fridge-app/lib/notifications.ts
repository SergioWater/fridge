import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

// How many days before expiry to notify. Tweak later or make user-configurable.
const DAYS_BEFORE = 2;

// Configure how notifications behave when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    // Simulators can't receive push, but local notifications work on real devices only.
    return false;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("expiry", {
      name: "Expiring items",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }
  return finalStatus === "granted";
}

export async function scheduleExpiryNotification(
  itemId: string,
  itemName: string,
  expiryDate: string, // ISO 'YYYY-MM-DD'
): Promise<string | null> {
  const expiry = new Date(expiryDate + "T09:00:00"); // 9am local on expiry day
  const trigger = new Date(expiry);
  trigger.setDate(trigger.getDate() - DAYS_BEFORE);

  // Don't schedule for times in the past.
  if (trigger.getTime() <= Date.now()) return null;

  const identifier = await Notifications.scheduleNotificationAsync({
    identifier: `expiry-${itemId}`,
    content: {
      title: `${itemName} expires soon`,
      body: `Use it by ${new Date(expiryDate).toLocaleDateString()}.`,
      data: { itemId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
      channelId: Platform.OS === "android" ? "expiry" : undefined,
    },
  });
  return identifier;
}

export async function cancelExpiryNotification(itemId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`expiry-${itemId}`);
  } catch {
    // Identifier may not exist — that's fine.
  }
}

// Cancels everything and reschedules from the current active inventory.
// Useful on app startup so we recover if the user reinstalled or wiped data.
export async function rescheduleAllFromItems(
  items: {
    id: string;
    name: string;
    expiry_date: string | null;
    status: string;
  }[],
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const it of items) {
    if (it.status !== "active") continue;
    if (!it.expiry_date) continue;
    await scheduleExpiryNotification(it.id, it.name, it.expiry_date);
  }
}
