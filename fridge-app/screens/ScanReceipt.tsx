import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { parseReceiptImage, ParsedItem } from "@/lib/parseReceipt";

type Props = {
  onClose: () => void;
  onConfirm: (items: ParsedItem[]) => Promise<void>;
};

type Row = ParsedItem & { include: boolean };

export default function ScanReceipt({ onClose, onConfirm }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera permission denied");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    await sendToServer(result.assets[0].uri, result.assets[0].base64);
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo library permission denied");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    await sendToServer(result.assets[0].uri, result.assets[0].base64);
  }

  async function sendToServer(uri: string, base64: string) {
    setPreview(uri);
    setLoading(true);
    setRows(null);
    try {
      const items = await parseReceiptImage(base64);
      setRows(items.map((i) => ({ ...i, include: true })));
      if (items.length === 0) {
        Alert.alert("No items found", "Try a clearer photo.");
      }
    } catch (e: any) {
      Alert.alert("Parsing failed", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(idx: number) {
    setRows((cur) =>
      cur
        ? cur.map((r, i) => (i === idx ? { ...r, include: !r.include } : r))
        : cur,
    );
  }

  function editName(idx: number, name: string) {
    setRows((cur) =>
      cur ? cur.map((r, i) => (i === idx ? { ...r, name } : r)) : cur,
    );
  }

  async function addAll() {
    if (!rows) return;
    const selected = rows.filter((r) => r.include && r.name.trim().length > 0);
    if (selected.length === 0) {
      Alert.alert("Nothing selected");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(selected.map(({ include, ...r }) => r));
      onClose();
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan receipt</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      {!rows && !loading ? (
        <View style={styles.actions}>
          <Pressable style={styles.bigBtn} onPress={takePhoto}>
            <Text style={styles.bigBtnText}>📷 Take photo</Text>
          </Pressable>
          <Pressable style={styles.bigBtnAlt} onPress={pickFromLibrary}>
            <Text style={styles.bigBtnAltText}>🖼️ Pick from library</Text>
          </Pressable>
          <Text style={styles.hint}>
            Tip: lay the receipt flat, in good light, no shadows.
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          {preview ? (
            <Image source={{ uri: preview }} style={styles.previewSmall} />
          ) : null}
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Reading receipt...</Text>
        </View>
      ) : null}

      {rows ? (
        <>
          <Text style={styles.sub}>
            Found {rows.length} item{rows.length === 1 ? "" : "s"}. Tap to
            include/exclude. Edit names if needed.
          </Text>
          <FlatList
            data={rows}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item, index }) => (
              <View style={styles.row}>
                <Pressable
                  style={[styles.checkbox, item.include && styles.checkboxOn]}
                  onPress={() => toggleRow(index)}
                >
                  {item.include ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : null}
                </Pressable>
                <TextInput
                  style={[styles.rowName, !item.include && styles.rowNameOff]}
                  value={item.name}
                  onChangeText={(t) => editName(index, t)}
                  placeholder="Item name"
                />
                <Text style={styles.qty}>
                  ×{item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                </Text>
              </View>
            )}
          />
          <View style={styles.footer}>
            <Pressable
              style={[styles.addAllBtn, saving && styles.disabled]}
              onPress={addAll}
              disabled={saving}
            >
              <Text style={styles.addAllText}>
                {saving
                  ? "Adding..."
                  : `Add ${rows.filter((r) => r.include).length} items`}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: "700" },
  close: { fontSize: 16, color: "#2563eb" },
  sub: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  actions: { marginTop: 40, gap: 16 },
  bigBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  bigBtnText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  bigBtnAlt: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  bigBtnAltText: { color: "#111827", fontSize: 17, fontWeight: "600" },
  hint: { fontSize: 13, color: "#6b7280", textAlign: "center", marginTop: 12 },
  loadingBox: { alignItems: "center", marginTop: 60, gap: 16 },
  loadingText: { color: "#6b7280", fontSize: 15 },
  previewSmall: { width: 160, height: 200, borderRadius: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  checkmark: { color: "#fff", fontWeight: "700" },
  rowName: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 4,
  },
  rowNameOff: { color: "#9ca3af", textDecorationLine: "line-through" },
  qty: { fontSize: 13, color: "#6b7280" },
  footer: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 30,
  },
  addAllBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  addAllText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
