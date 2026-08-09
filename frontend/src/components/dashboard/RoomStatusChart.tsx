import React from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

interface RoomStatusData {
  status: string;
  count: number;
}

interface RoomStatusChartProps {
  data: RoomStatusData[];
}

const STATUS_COLORS: Record<string, string> = {
  vacant_dirty: "rgba(245, 158, 11, 0.8)", // amber-500
  assigned: "rgba(59, 130, 246, 0.8)", // blue-500
  in_progress: "rgba(168, 85, 247, 0.8)", // purple-500
  inspection: "rgba(236, 72, 153, 0.8)", // pink-500
  ready: "rgba(16, 185, 129, 0.8)", // emerald-500
};

export default function RoomStatusChart({ data }: RoomStatusChartProps) {
  const chartData = {
    labels: data.map((d) => d.status.replace("_", " ").toUpperCase()),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: data.map((d) => STATUS_COLORS[d.status] || "rgba(156, 163, 175, 0.8)"),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
      },
    },
  };

  return (
    <div className="h-[300px] w-full">
      <Pie data={chartData} options={options} />
    </div>
  );
}
