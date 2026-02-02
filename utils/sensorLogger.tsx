import { DeviceMotion } from "expo-sensors";

export type SensorData = {
  accelerometer: { x: number; y: number; z: number };
  gyroscope: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  timestamp: number;
};

type SensorCallback = (data: SensorData) => void;

function eulerToQuaternion(alpha: number, beta: number, gamma: number) {
  const cy = Math.cos(alpha * 0.5);
  const sy = Math.sin(alpha * 0.5);
  const cp = Math.cos(beta * 0.5);
  const sp = Math.sin(beta * 0.5);
  const cr = Math.cos(gamma * 0.5);
  const sr = Math.sin(gamma * 0.5);

  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
  };
}

export async function startSensors(
  onData: SensorCallback,
  updateInterval = 10,
) {
  const { status } = await DeviceMotion.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permission for DeviceMotion was denied.");
  }

  const isAvailable = await DeviceMotion.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("DeviceMotion is not available on this device.");
  }

  DeviceMotion.setUpdateInterval(updateInterval);

  const startTime = Date.now();

  const subscription = DeviceMotion.addListener((dm) => {
    if (!dm.rotation || !dm.accelerationIncludingGravity || !dm.rotationRate) {
      return;
    }

    const timestamp = Date.now() - startTime;

    const quaternion = eulerToQuaternion(
      dm.rotation.alpha,
      dm.rotation.beta,
      dm.rotation.gamma,
    );

    onData({
      timestamp,
      accelerometer: {
        x: dm.accelerationIncludingGravity.x,
        y: dm.accelerationIncludingGravity.y,
        z: dm.accelerationIncludingGravity.z,
      },
      gyroscope: {
        x: dm.rotationRate.alpha,
        y: dm.rotationRate.beta,
        z: dm.rotationRate.gamma,
      },
      rotation: quaternion,
    });
  });

  return () => {
    subscription.remove();
  };
}
