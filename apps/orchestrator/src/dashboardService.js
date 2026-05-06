export async function getDashboardPayload() {
  return {
    profile: {
      summary: 'No household profile has been computed yet.',
      sourceCount: 0,
    },
    brief: [],
    reminders: [],
  }
}