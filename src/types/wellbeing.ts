// The wellbeing wire types live next to the code that builds the requests
// (src/app/settings/_lib/wellbeing.ts), which follows user-service's
// wellbeing_validate.go. These aliases keep the old import path working.
export type {
  Wellbeing as DigitalWellbeing,
  WellbeingRequest,
  ScreenTimeDay,
  ScreenTimeWeek as ScreenTimeResponse,
} from "@/app/settings/_lib/wellbeing"
