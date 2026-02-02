import { create } from "zustand";
import { SensorData } from "../utils/sensorLogger";

interface SensorStore {
  data: SensorData[];
  setData: (newData: SensorData[]) => void;
  clearData: () => void;
}

export const useSensorStore = create<SensorStore>((set) => ({
  data: [],
  setData: (newData) => set({ data: newData }),
  clearData: () => set({ data: [] }),
}));
