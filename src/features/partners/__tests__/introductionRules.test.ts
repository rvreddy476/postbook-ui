import { describe, expect, test } from "bun:test"
import { introductionFileError, INTRODUCTION_MAX_BYTES } from "../introductionRules"

describe("partner introduction limits", () => {
  test("allows a one-minute video at the size boundary", () => {
    expect(introductionFileError({type:"video/mp4",size:INTRODUCTION_MAX_BYTES},60)).toBeNull()
  })
  test("accepts supported camera formats", () => {
    for(const type of ["video/mp4","video/webm","video/quicktime"]) expect(introductionFileError({type,size:100},1)).toBeNull()
  })
  test("rejects oversized, empty and non-video files", () => {
    expect(introductionFileError({type:"video/mp4",size:INTRODUCTION_MAX_BYTES+1})).not.toBeNull()
    expect(introductionFileError({type:"video/mp4",size:0})).not.toBeNull()
    expect(introductionFileError({type:"image/jpeg",size:100})).not.toBeNull()
  })
  test("rejects long or unreadable duration", () => {
    for(const duration of [60.001,0,-1,Infinity,NaN]) expect(introductionFileError({type:"video/mp4",size:100},duration)).not.toBeNull()
  })
})
