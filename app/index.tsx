import { Audio } from "expo-av";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSensorStore } from "../store/sensorStore";
import { SensorData, startSensors } from "../utils/sensorLogger";

const MAX_DURATION = 5.0;
const UI_UPDATE_INTERVAL = 100;

export default function RecordScreen() {
  const { activity, position } = useLocalSearchParams<{
    activity: string;
    position: string;
  }>();
  const router = useRouter();
  useKeepAwake();

  const [displayData, setDisplayData] = useState<SensorData | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasData, setHasData] = useState(false);

  const dataRef = useRef<SensorData[]>([]);
  const sensorStopRef = useRef<(() => void) | null>(null);
  const lastUiUpdate = useRef<number>(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const setSensorData = useSensorStore((state) => state.setData);

  useEffect(() => {
    const loadSound = async () => {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/bell.mp3"),
      );
      soundRef.current = sound;
    };
    loadSound();

    return () => {
      sensorStopRef.current?.();
      soundRef.current?.unloadAsync();
    };
  }, []);

  const playBell = async () => {
    try {
      if (soundRef.current) await soundRef.current.replayAsync();
    } catch (error) {
      console.log("Error playing sound", error);
    }
  };

  const stopRecording = async (playBellSound = false) => {
    sensorStopRef.current?.();
    sensorStopRef.current = null;
    setIsRecording(false);
    if (playBellSound) await playBell();
    if (dataRef.current.length > 0) setHasData(true);
  };

  const startRecording = async () => {
    if (isRecording) return;
    dataRef.current = [];
    setDisplayData(null);
    setIsRecording(true);
    setHasData(false);

    try {
      sensorStopRef.current = await startSensors((data) => {
        dataRef.current.push(data);

        const now = Date.now();
        if (now - lastUiUpdate.current > UI_UPDATE_INTERVAL) {
          setDisplayData(data);
          lastUiUpdate.current = now;
        }

        if (data.timestamp / 1000 >= MAX_DURATION) stopRecording(true);
      }, 10);
    } catch (err: any) {
      Alert.alert("Error", err.message);
      setIsRecording(false);
    }
  };

  const clearData = () => {
    stopRecording(false);
    dataRef.current = [];
    setDisplayData(null);
    setHasData(false);
  };

  const continueToModel = () => {
    if (!hasData)
      return Alert.alert("No data", "Please record some data first.");
    setSensorData(dataRef.current);
    router.push("/model");
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.header}>
          {activity} - {position} Recording
        </Text>

        <View style={styles.vitalsBox}>
          <Text style={styles.vitalsText}>
            <Text style={styles.label}>Accel X:</Text>{" "}
            {displayData?.accelerometer.x.toFixed(2) ?? "0.00"}{" "}
            <Text style={styles.label}>Y:</Text>{" "}
            {displayData?.accelerometer.y.toFixed(2) ?? "0.00"}{" "}
            <Text style={styles.label}>Z:</Text>{" "}
            {displayData?.accelerometer.z.toFixed(2) ?? "0.00"}
          </Text>

          <Text style={styles.vitalsText}>
            <Text style={styles.label}>Gyro X:</Text>{" "}
            {displayData?.gyroscope.x.toFixed(2) ?? "0.00"}{" "}
            <Text style={styles.label}>Y:</Text>{" "}
            {displayData?.gyroscope.y.toFixed(2) ?? "0.00"}{" "}
            <Text style={styles.label}>Z:</Text>{" "}
            {displayData?.gyroscope.z.toFixed(2) ?? "0.00"}
          </Text>

          <Text style={styles.vitalsText}>
            <Text style={styles.label}>Rotation (Quaternion):</Text>
            {"\n"}
            x: {displayData?.rotation.x.toFixed(3) ?? "0.000"} y:{" "}
            {displayData?.rotation.y.toFixed(3) ?? "0.000"} z:{" "}
            {displayData?.rotation.z.toFixed(3) ?? "0.000"} w:{" "}
            {displayData?.rotation.w.toFixed(3) ?? "1.000"}
          </Text>

          <Text style={styles.vitalsText}>
            <Text style={styles.label}>Recording Time:</Text>{" "}
            {((displayData?.timestamp ?? 0) / 1000).toFixed(1)}s
          </Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            onPress={startRecording}
            disabled={isRecording}
            style={[
              styles.customButton,
              styles.primaryButton,
              isRecording && styles.disabledButton,
            ]}
          >
            <Text style={styles.buttonText}>Start Recording</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => stopRecording(false)}
            disabled={!isRecording}
            style={[
              styles.customButton,
              styles.dangerButton,
              !isRecording && styles.disabledButton,
            ]}
          >
            <Text style={styles.buttonText}>Stop Recording</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={clearData}
          disabled={!hasData}
          style={[
            styles.customButton,
            styles.primaryButton,
            !hasData && styles.disabledButton,
          ]}
        >
          <Text style={styles.buttonText}>Clear Data</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={continueToModel}
          disabled={!hasData || isRecording}
          style={[
            styles.customButton,
            styles.orangeButton,
            (!hasData || isRecording) && styles.disabledButton,
          ]}
        >
          <Text style={styles.buttonText}>Continue to Model</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { paddingBottom: 40 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 40 },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
  },
  vitalsBox: {
    backgroundColor: "#f9f9f9",
    padding: 14,
    borderRadius: 8,
    marginBottom: 24,
  },
  vitalsText: { fontSize: 15, marginBottom: 8 },
  label: { fontWeight: "bold" },
  btnRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginVertical: 16,
  },
  customButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
  },
  primaryButton: { backgroundColor: "#2563eb" },
  dangerButton: { backgroundColor: "#ef4444" },
  orangeButton: { backgroundColor: "#f59e0b" },
  disabledButton: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
