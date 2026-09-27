export interface HourlyPoint {
  label: string;
  value: number;
}

export interface StatsSnapshot {
  allTime: number;
  emails24h: number;
  uniqueSubjects: number;
  siteDomains: number;
  hourly: HourlyPoint[];
  peakLabel: string;
  peakValue: number;
  activeHours: number;
  avgPerHour: number;
}

export interface TopListRow {
  label: string;
  count: number;
}

export interface TopListData {
  title: string;
  rows: TopListRow[];
}
