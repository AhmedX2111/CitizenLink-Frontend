export interface DailyVolumeRow {
  date:     string;   // yyyy-MM-dd
  created:  number;
  resolved: number;
}

export interface CategoryCount {
  categoryNameEn: string;
  categoryNameAr: string;
  count:          number;
  percentage:     number;
}

export interface VolumeReportResponse {
  dailyVolume:    DailyVolumeRow[];
  topCategories:  CategoryCount[];
}