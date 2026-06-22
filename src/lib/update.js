const UPDATE_URL = "https://updates.foodorder.com.ly/latest.json";

export async function getUpdateLinks() {
  const res = await fetch(UPDATE_URL);

  if (!res.ok) {
    throw new Error(`Failed to fetch updates: ${res.status}`);
  }

  const data = await res.json();
  return data.latest;
}