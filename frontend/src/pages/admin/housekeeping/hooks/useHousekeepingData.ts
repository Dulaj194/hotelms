import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { RoomListResponse, RoomResponse } from "@/types/room";
import type { StaffListItemResponse } from "@/types/user";
import type {
  HousekeepingDailySummaryResponse,
  HousekeepingPendingListResponse,
  HousekeepingRequestListResponse,
  HousekeepingRequestResponse,
  HousekeepingStaffPerformanceResponse,
} from "@/types/housekeeping";
import { getErrorMessage } from "../utils/housekeepingHelpers";

type Params = {
  supervisor: boolean;
  typeFilter: string;
  priorityFilter: string;
  reportDate: string;
};

export function useHousekeepingData({
  supervisor,
  typeFilter,
  priorityFilter,
  reportDate,
}: Params) {
  const [requests, setRequests] = useState<HousekeepingRequestResponse[]>([]);
  const [staff, setStaff] = useState<StaffListItemResponse[]>([]);
  const [rooms, setRooms] = useState<RoomResponse[]>([]);

  const [summary, setSummary] =
    useState<HousekeepingDailySummaryResponse | null>(null);
  const [pendingList, setPendingList] =
    useState<HousekeepingPendingListResponse | null>(null);
  const [staffPerformance, setStaffPerformance] =
    useState<HousekeepingStaffPerformanceResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const qs = new URLSearchParams();
      if (typeFilter) qs.set("request_type", typeFilter);
      if (priorityFilter) qs.set("priority", priorityFilter);

      const path = qs.toString() ? `/housekeeping?${qs}` : "/housekeeping";
      const data = await api.get<HousekeepingRequestListResponse>(path);
      setRequests(data.requests);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load housekeeping tasks."));
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, typeFilter]);

  const loadStaff = useCallback(async () => {
    if (!supervisor) {
      setStaff([]);
      return;
    }

    try {
      const data = await api.get<StaffListItemResponse[]>(
        "/users?role=housekeeper&is_active=true"
      );
      setStaff(data);
    } catch {
      setStaff([]);
    }
  }, [supervisor]);

  const loadRooms = useCallback(async () => {
    if (!supervisor) {
      setRooms([]);
      return;
    }

    try {
      const data = await api.get<RoomListResponse>("/rooms");
      setRooms(data.rooms);
    } catch {
      setRooms([]);
    }
  }, [supervisor]);

  const loadReports = useCallback(async () => {
    if (!supervisor) {
      setSummary(null);
      setPendingList(null);
      setStaffPerformance(null);
      setReportsError(null);
      return;
    }

    setReportsLoading(true);
    setReportsError(null);

    try {
      const query = new URLSearchParams({ date_value: reportDate }).toString();

      const [summaryResult, pendingResult, performanceResult] =
        await Promise.allSettled([
          api.get<HousekeepingDailySummaryResponse>(
            `/housekeeping/reports/daily-summary?${query}`
          ),
          api.get<HousekeepingPendingListResponse>(
            "/housekeeping/reports/pending-list"
          ),
          api.get<HousekeepingStaffPerformanceResponse>(
            `/housekeeping/reports/staff-performance?${query}`
          ),
        ]);

      setSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
      setPendingList(
        pendingResult.status === "fulfilled" ? pendingResult.value : null
      );
      setStaffPerformance(
        performanceResult.status === "fulfilled"
          ? performanceResult.value
          : null
      );

      const failures = [summaryResult, pendingResult, performanceResult].filter(
        (result) => result.status === "rejected"
      );

      if (failures.length > 0) {
        const firstFailure = failures[0] as PromiseRejectedResult;
        setReportsError(
          getErrorMessage(
            firstFailure.reason,
            "Some housekeeping reports could not be loaded."
          )
        );
      }
    } finally {
      setReportsLoading(false);
    }
  }, [reportDate, supervisor]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadRequests(),
      ...(supervisor ? [loadStaff(), loadRooms(), loadReports()] : []),
    ]);
  }, [loadRequests, loadReports, loadRooms, loadStaff, supervisor]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!supervisor) return;
    void Promise.all([loadStaff(), loadRooms()]);
  }, [loadRooms, loadStaff, supervisor]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadRequests();
      if (supervisor) void loadReports();
    }, 60000);

    return () => window.clearInterval(timer);
  }, [loadReports, loadRequests, supervisor]);

  return {
    requests,
    staff,
    rooms,
    summary,
    pendingList,
    staffPerformance,
    loading,
    reportsLoading,
    pageError,
    reportsError,
    setPageError,
    setReportsError,
    loadRequests,
    loadReports,
    refreshAll,
  };
}
