const BASE_URL = "http://localhost:8008/api";

export async function getDashboardSummary() {
  const response = await fetch(`${BASE_URL}/dashboard/summary`);

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return response.json();
}