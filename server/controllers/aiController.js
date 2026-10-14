import { asyncHandler } from '../utils/asyncHandler.js';
import { todayStr } from '../utils/dates.js';
import {
  askAssistant,
  generatePlanHints,
  getAiStatus,
  testConnection,
} from '../services/geminiService.js';
import {
  buildAssistantContext,
  currentPriorities,
  generateAndSavePlan,
  loadStudentData,
  requireConfirmation,
  validateAcademicData,
} from '../services/planService.js';

export const aiStatus = (req, res) => {
  res.json({ status: getAiStatus() });
};

export const aiTest = asyncHandler(async (req, res) => {
  res.json({ result: await testConnection() });
});

/**
 * POST /api/ai/generate-study-plan
 * 1 validate  2 collect data  3 calculate priorities  4 call Gemini  5 validate the AI JSON
 * 6 run the scheduling algorithm  7 save  8 return the plan.
 * If Gemini fails the error is returned as-is: no fake AI plan is ever created.
 */
export const generateAiStudyPlan = asyncHandler(async (req, res) => {
  const { planDays, confirm } = req.body;
  const now = new Date();
  const data = loadStudentData(req.user.id);

  validateAcademicData(data); // 1-2
  requireConfirmation(data, now, confirm); // asked BEFORE spending an AI request

  const priorities = currentPriorities(data, now); // 3
  const { hints, model } = await generatePlanHints({
    // 4-5 (structure is checked here; values are cleaned by the scheduler)
    today: todayStr(now),
    subjects: data.subjects,
    priorities,
    exams: data.exams,
    assignments: data.assignments,
    availability: data.availability,
  });

  const result = generateAndSavePlan({
    // 6-7
    userId: req.user.id,
    data,
    now,
    planDays,
    aiRaw: hints,
    aiUsed: true,
    aiModel: model,
  });
  res.status(201).json(result); // 8
});

export const assistant = asyncHandler(async (req, res) => {
  const { question, history } = req.body;
  const context = buildAssistantContext(req.user.id); // only THIS student's data
  const { answer, model } = await askAssistant({ question, history, context });
  res.json({ answer, model });
});