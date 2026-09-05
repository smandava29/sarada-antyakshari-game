import { describe, expect, it } from "vitest";
import { mapAttemptRow, mapGameRow, toD1Boolean, toD1Timestamp } from "./d1-types";

describe("D1 application datatype boundary", () => {
  it("converts integer booleans and Unix timestamps", () => {
    const attempt = mapAttemptRow({
      attempt_number: 1,
      attempt_type: "guess",
      submitted_song_id: "song-id",
      was_correct: 1,
      song_title: "Song",
      movie_title: null,
      created_at: 1_700_000_000,
    });

    expect(attempt.wasCorrect).toBe(true);
    expect(attempt.createdAt.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(toD1Boolean(false)).toBe(0);
    expect(toD1Timestamp(attempt.createdAt)).toBe(1_700_000_000);
  });

  it("rejects invalid enum and boolean values from D1", () => {
    expect(() => mapAttemptRow({
      attempt_number: 1,
      attempt_type: "delete",
      submitted_song_id: null,
      was_correct: 4,
      song_title: null,
      movie_title: null,
      created_at: 1_700_000_000,
    })).toThrow("invalid attempt_type");
  });

  it("maps a raw D1 session into application-native names and Date objects", () => {
    const game = mapGameRow({
      token_hash: "a".repeat(64),
      question_date: "2026-09-03",
      attempts_used: 2,
      status: "playing",
      expires_at: 1_800_000_000,
      version: 2,
      answer_song_id: "song-id",
      song_title: "Song",
      movie_title: "Movie",
      composer: null,
      release_year: 2025,
      released_at: null,
    });

    expect(game).toMatchObject({
      questionDate: "2026-09-03",
      attemptsUsed: 2,
      answerSongId: "song-id",
    });
    expect(game?.expiresAt).toBeInstanceOf(Date);
  });
});
