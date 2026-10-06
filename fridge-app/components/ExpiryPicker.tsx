import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

type Props = {
  value: Date | null;
  onChange: (date: Date | null) => void;
  autoOpen?: boolean;
  onDismiss?: () => void;
};

export default function ExpiryPicker({ value, onChange, autoOpen, onDismiss }: Props) {
  const [showing, setShowing] = useState(autoOpen ?? false);
  // On iOS we render the picker in a modal sheet with our own background.
  // On Android the OS provides the dialog.
  const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

  function open() {
    setTempDate(value ?? new Date());
    setShowing(true);
  }

  function handleIosChange(_e: DateTimePickerEvent, selected?: Date) {
    if (selected) setTempDate(selected);
  }

  function handleAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    setShowing(false);
    if (event.type === "set" && selected) onChange(selected);
  }

  function confirmIos() {
    onChange(tempDate);
    setShowing(false);
  }

  function clearDate() {
    onChange(null);
    setShowing(false);
  }

  const label = value
    ? value.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Add expiry";

  return (
    <View>
      <Pressable style={styles.btn} onPress={open}>
        <Text style={styles.btnText}>📅 {label}</Text>
      </Pressable>

      {showing && Platform.OS === "android" ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          transparent
          animationType="slide"
          visible={showing}
          onRequestClose={() => { setShowing(false); onDismiss?.(); }}
        >
          <Pressable style={styles.backdrop} onPress={() => { setShowing(false); onDismiss?.(); }}>
            <Pressable
              style={styles.sheet}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHeader}>
                <Pressable onPress={clearDate}>
                  <Text style={styles.clearBtn}>Clear</Text>
                </Pressable>
                <Text style={styles.sheetTitle}>Expiry date</Text>
                <Pressable onPress={confirmIos}>
                  <Text style={styles.doneBtn}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={handleIosChange}
                themeVariant="light"
                accentColor="#2563eb"
                textColor="#111827"
                style={styles.picker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
  },
  btnText: { fontSize: 14, color: "#374151" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  sheetTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  clearBtn: { color: "#dc2626", fontSize: 15 },
  doneBtn: { color: "#2563eb", fontSize: 15, fontWeight: "600" },
  picker: { backgroundColor: "#ffffff" },
});
