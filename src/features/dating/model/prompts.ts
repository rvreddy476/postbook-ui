/* Prompts: the catalogue, and the caller's answers. */

import { PROMPT_ANSWER_MAX } from "./labels"
import { arr, num, obj, str } from "./wire"

export interface PromptQuestion {
  id: number
  question: string
}

export interface PromptAnswer {
  promptId: number
  answer: string
}

export function toPromptCatalog(wire: unknown): PromptQuestion[] {
  return arr(wire)
    .map((raw) => {
      const p = obj(raw)
      return { id: num(p.id), question: str(p.question) }
    })
    .filter((p) => p.id > 0 && p.question)
    .sort((a, b) => a.question.localeCompare(b.question))
}

export function toPromptAnswer(wire: unknown): PromptAnswer | null {
  const w = obj(wire)
  const promptId = num(w.prompt_id)
  return promptId > 0 ? { promptId, answer: str(w.answer) } : null
}

export function toPromptAnswers(wire: unknown): PromptAnswer[] {
  return arr(wire)
    .map(toPromptAnswer)
    .filter((p): p is PromptAnswer => p !== null)
}

export function answerProblem(answer: string): string {
  const a = answer.trim()
  if (!a) return "Write an answer first."
  if (a.length > PROMPT_ANSWER_MAX) return `Keep your answer to ${PROMPT_ANSWER_MAX} characters.`
  return ""
}
