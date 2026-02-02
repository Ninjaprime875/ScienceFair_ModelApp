import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-react-native";
import { bundleResourceIO } from "@tensorflow/tfjs-react-native";

import { useSensorStore } from "../store/sensorStore";

const MODEL_WINDOW_SIZE = 100;

export default function ModelScreen() {
  const router = useRouter();
  const sensorData = useSensorStore((state) => state.data);
  const [prediction, setPrediction] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<tf.GraphModel | null>(null);

  const modelJson = require("../assets/tfjs_model/model.json");
  const modelWeights = require("../assets/tfjs_model/group1-shard1of1.bin");
  const modelMetadata = require("../assets/tfjs_model/model_metadata.json");

  const activityClasses = modelMetadata.labels as string[];

  type Vector3 = { x: number; y: number; z: number };
  type Quaternion = { x: number; y: number; z: number; w: number };

  const rotateVectorByQuaternion = (v: Vector3, q: Quaternion): Vector3 => {
    const { x: qx, y: qy, z: qz, w: qw } = q;

    const ix = qw * v.x + qy * v.z - qz * v.y;
    const iy = qw * v.y + qz * v.x - qx * v.z;
    const iz = qw * v.z + qx * v.y - qy * v.x;
    const iw = -qx * v.x - qy * v.y - qz * v.z;

    return {
      x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
      y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
      z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
    };
  };

  const transformToGlobalFrame = (
    acc: Vector3,
    gyro: Vector3,
    q: Quaternion,
  ) => {
    const norm = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    const nq = { w: q.w / norm, x: q.x / norm, y: q.y / norm, z: q.z / norm };

    const qConj = { w: nq.w, x: -nq.x, y: -nq.y, z: -nq.z };

    const gyroMapped = { x: gyro.y, y: gyro.z, z: gyro.x };

    const accGlobal = rotateVectorByQuaternion(acc, qConj);
    const gyroGlobal = rotateVectorByQuaternion(gyroMapped, qConj);

    accGlobal.z -= 9.81;

    return { acc: accGlobal, gyro: gyroGlobal };
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await tf.ready();
      try {
        const loadedModel = await tf.loadGraphModel(
          bundleResourceIO(modelJson, modelWeights),
        );
        setModel(loadedModel);
        console.log("Model loaded successfully!");
      } catch (err) {
        console.error("Error loading model:", err);
      }
      setLoading(false);
    })();
  }, []);

  const runModel = async () => {
    if (!model) return;

    if (sensorData.length < MODEL_WINDOW_SIZE) {
      console.warn(`Not enough data. Need ${MODEL_WINDOW_SIZE} samples.`);
      return;
    }

    setLoading(true);

    try {
      const inputWindow = sensorData.slice(-MODEL_WINDOW_SIZE);

      const rawInput = inputWindow.map((sample) => {
        const { acc, gyro } = transformToGlobalFrame(
          sample.accelerometer,
          sample.gyroscope,
          sample.rotation,
        );

        return [acc.x, acc.y, acc.z, gyro.x, gyro.y, gyro.z];
      });

      const normalizedInput = rawInput.map((row) =>
        row.map(
          (val, i) => (val - modelMetadata.mean[i]) / modelMetadata.std[i],
        ),
      );

      const inputTensor = tf.tensor3d(
        [normalizedInput],
        [1, MODEL_WINDOW_SIZE, 6],
      );

      const outputTensor = model.predict(inputTensor) as tf.Tensor;
      const outputArray = (await outputTensor.array()) as number[][];

      if (!outputArray || outputArray.length === 0) {
        console.error("Empty output from model");
        setLoading(false);
        return;
      }

      const probs = outputArray[0];
      const maxIdx = probs.indexOf(Math.max(...probs));
      const predictedLabel = activityClasses[maxIdx];

      console.log("Raw probabilities:", probs);
      console.log("Predicted class index:", maxIdx);
      console.log("Predicted class label:", predictedLabel);

      setPrediction(probs);

      inputTensor.dispose();
      outputTensor.dispose();
    } catch (err) {
      console.error("Prediction error:", err);
    }

    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Model Prediction</Text>

      {sensorData.length < MODEL_WINDOW_SIZE && (
        <Text style={styles.message}>
          Need {MODEL_WINDOW_SIZE} data points. Currently: {sensorData.length}
        </Text>
      )}

      {loading && (
        <ActivityIndicator
          size="large"
          color="#2563eb"
          style={{ marginVertical: 20 }}
        />
      )}

      {prediction && (
        <View style={styles.predictionBox}>
          <Text style={styles.predictionText}>Predicted Activity:</Text>
          {prediction.map((val, i) => (
            <Text key={i} style={styles.predictionText}>
              {activityClasses[i]}: {(val * 100).toFixed(1)}%
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.customButton,
          styles.primaryButton,
          (sensorData.length < MODEL_WINDOW_SIZE || loading) &&
            styles.disabledButton,
        ]}
        onPress={runModel}
        disabled={sensorData.length < MODEL_WINDOW_SIZE || loading}
      >
        <Text style={styles.buttonText}>Run Model</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.customButton, styles.dangerButton]}
        onPress={() => router.back()}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 24 },
  message: { fontSize: 16, marginBottom: 20, textAlign: "center" },
  predictionBox: {
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 8,
    marginVertical: 20,
    width: "100%",
  },
  predictionText: { fontSize: 16, marginBottom: 8 },
  customButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
    width: "60%",
  },
  primaryButton: { backgroundColor: "#2563eb" },
  dangerButton: { backgroundColor: "#ef4444" },
  disabledButton: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
