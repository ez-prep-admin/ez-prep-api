import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import {
  Question,
  QuestionDocument,
} from '../mock-test-attempts/schemas/question.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';
import { MockTestsService } from '../mock-tests/mock-tests.service';
import { PaperType } from '../common/enums/paper-type.enum';
import { UserAttemptAction } from '../common/enums/user-attempt-action.enum';
import { PaginationMetaDto } from '../common/dto/api-response.dto';
import { PopulatedDocument } from '../common/types/populated-document.interface';
import { FullMockSelectionService } from './full-mock-selection.service';
import {
  FullMockTestDraft,
  FullMockTestDraftDocument,
} from './schemas/full-mock-test-draft.schema';
import { CreateDraftDto } from './dto/create-draft.dto';
import { PublishDraftDto } from './dto/publish-draft.dto';
import { FullMockExamListItemDto } from './dto/exam-list-item.dto';
import { DraftResponseDto } from './dto/draft-response.dto';
import { FullMockTestListItemDto } from './dto/full-mock-test-list-item.dto';
import { SafeQuestionDto } from '../mock-test-attempts/dto/start-attempt-response.dto';
import { SearchQuestionItemDto } from './dto/search-question-item.dto';

@Injectable()
export class FullMockTestsService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(MockTest.name)
    private readonly mockTestModel: Model<MockTestDocument>,
    @InjectModel(FullMockTestDraft.name)
    private readonly draftModel: Model<FullMockTestDraftDocument>,
    private readonly selectionService: FullMockSelectionService,
    private readonly mockTestsService: MockTestsService,
  ) {}

  async listExamsForAdmin(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{
    data: FullMockExamListItemDto[];
    pagination: PaginationMetaDto;
  }> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<ExamDocument> = { isActive: true };
    if (search?.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const [exams, total] = await Promise.all([
      this.examModel
        .find(query)
        .populate('category', 'name')
        .populate('examGroup', 'name')
        .sort({ name: 1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.examModel.countDocuments(query).exec(),
    ]);

    const subjectIds = [
      ...new Set(
        exams.flatMap(exam =>
          Array.from(exam.subjects || [])
            .map(row => this.subjectIdFromRow(row))
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    const subjects = subjectIds.length
      ? await this.subjectModel
          .find({ _id: { $in: subjectIds.map(id => new Types.ObjectId(id)) } })
          .select('_id name')
          .lean()
          .exec()
      : [];
    const subjectNameById = new Map(
      subjects.map(s => [s._id.toString(), s.name]),
    );

    const totalPages = Math.ceil(total / validLimit) || 0;

    return {
      data: exams.map(exam => {
        const category = exam.category as unknown as PopulatedDocument;
        const examGroup = exam.examGroup as unknown as PopulatedDocument;
        return {
          id: exam._id.toString(),
          examName: exam.name,
          duration: exam.duration != null ? `${exam.duration} mins` : undefined,
          questions: exam.totalQuestions,
          totalMarks: exam.totalMarks,
          category: category?.name,
          examGroup: examGroup?.name || undefined,
          subjects: Array.from(exam.subjects || [])
            .map(row => {
              const id = this.subjectIdFromRow(row);
              return id ? subjectNameById.get(id) || id : undefined;
            })
            .filter((name): name is string => Boolean(name)),
          mode: exam.isSessionWise ? 'Session-wise' : 'Mixed',
        };
      }),
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1,
      },
    };
  }

  async createDraft(
    dto: CreateDraftDto,
    userId: string,
  ): Promise<DraftResponseDto> {
    if (!Types.ObjectId.isValid(dto.examId)) {
      throw new BadRequestException({
        message: 'Invalid exam ID',
        error: 'EXAM_NOT_FOUND',
      });
    }

    const exam = await this.examModel.findById(dto.examId).exec();
    if (!exam || !exam.isActive) {
      throw new NotFoundException({
        message: 'Exam not found or inactive',
        error: 'EXAM_NOT_FOUND',
      });
    }

    const { questions, subjectNames } =
      await this.selectionService.generatePaper(exam);
    this.assertNoDuplicateQuestions(questions);

    const draft = await this.draftModel.create({
      exam: exam._id,
      createdBy: new Types.ObjectId(userId),
      status: 'REVIEW',
      examSnapshot: {
        name: exam.name,
        description: exam.description,
        duration: exam.duration,
        totalQuestions: exam.totalQuestions,
        totalMarks: exam.totalMarks,
        isSessionWise: exam.isSessionWise,
        subjects: exam.subjects.map(row => ({
          subject: row.subject,
          name: subjectNames.get(row.subject.toString()) || '',
          numberOfQuestions: row.numberOfQuestions,
          marksPerQuestion: row.marksPerQuestion,
          hasNegativeMarking: row.hasNegativeMarking,
          negativeMarksPerQuestion: row.negativeMarksPerQuestion || 0,
          sessionTime: row.sessionTime,
        })),
      },
      questions,
    });

    return this.toDraftResponse(draft);
  }

  async getDraft(draftId: string): Promise<DraftResponseDto> {
    const draft = await this.loadDraft(draftId);
    return this.toDraftResponse(draft);
  }

  async searchQuestions(params: {
    subjectId: string;
    draftId?: string;
    search?: string;
    topicId?: string;
    difficultyLevel?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: SearchQuestionItemDto[];
    pagination: PaginationMetaDto;
  }> {
    if (!Types.ObjectId.isValid(params.subjectId)) {
      throw new BadRequestException('Invalid subject ID');
    }

    const validPage = Math.max(1, params.page || 1);
    const validLimit = Math.min(Math.max(1, params.limit || 20), 50);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<QuestionDocument> = {
      subject: new Types.ObjectId(params.subjectId),
      isActive: true,
      difficultyLevel: { $in: ['easy', 'medium', 'hard'] },
    };

    if (params.topicId) {
      if (!Types.ObjectId.isValid(params.topicId)) {
        throw new BadRequestException('Invalid topic ID');
      }
      query.topic = new Types.ObjectId(params.topicId);
    }

    if (params.difficultyLevel) {
      query.difficultyLevel = params.difficultyLevel;
    }

    if (params.search?.trim()) {
      const term = params.search.trim();
      query.$or = [
        { 'questionText.en.text': { $regex: term, $options: 'i' } },
        { 'questionText.ml.text': { $regex: term, $options: 'i' } },
      ];
    }

    if (params.draftId) {
      const draft = await this.loadDraft(params.draftId);
      const exclude = draft.questions.map(q => q.question);
      if (exclude.length) {
        query._id = { $nin: exclude };
      }
    }

    const [docs, total] = await Promise.all([
      this.questionModel
        .find(query)
        .select('-correctAnswer -explanation')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .lean()
        .exec(),
      this.questionModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / validLimit) || 0;

    return {
      data: docs.map(q => {
        const safe = this.toSafeQuestion(q);
        const snippet = q.questionText?.en?.text
          ? q.questionText.en.text.slice(0, 100)
          : undefined;
        return { ...safe, snippet };
      }),
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1,
      },
    };
  }

  async replaceQuestion(
    draftId: string,
    position: number,
    questionId: string,
  ): Promise<DraftResponseDto> {
    const draft = await this.loadDraft(draftId);
    if (draft.status !== 'REVIEW') {
      throw new BadRequestException({
        message: 'Draft is not editable',
        error: 'DRAFT_NOT_EDITABLE',
      });
    }

    const slot = draft.questions.find(q => q.position === position);
    if (!slot) {
      throw new BadRequestException(`No question at position ${position}`);
    }

    if (!Types.ObjectId.isValid(questionId)) {
      throw new BadRequestException({
        message: 'Invalid question ID',
        error: 'QUESTION_NOT_ELIGIBLE',
      });
    }

    const incoming = await this.questionModel.findById(questionId).exec();
    if (
      !incoming ||
      !incoming.isActive ||
      !incoming.difficultyLevel ||
      !['easy', 'medium', 'hard'].includes(incoming.difficultyLevel)
    ) {
      throw new BadRequestException({
        message: 'Question is not eligible',
        error: 'QUESTION_NOT_ELIGIBLE',
      });
    }

    if (incoming.subject?.toString() !== slot.subject.toString()) {
      throw new BadRequestException({
        message: 'Replacement question must belong to the same subject',
        error: 'SUBJECT_MISMATCH',
      });
    }

    const existingSlot = draft.questions.find(
      q =>
        q.position !== position &&
        q.question?.toString() === incoming._id.toString(),
    );
    if (existingSlot) {
      throw new BadRequestException({
        message: `This question is already on the paper at position ${existingSlot.position + 1}`,
        error: 'DUPLICATE_QUESTION',
        details: {
          questionId: incoming._id.toString(),
          existingPosition: existingSlot.position,
          attemptedPosition: position,
        },
      });
    }

    slot.replacedFrom = slot.question;
    slot.question = incoming._id as Types.ObjectId;
    slot.topic = incoming.topic;
    slot.difficultyLevel = incoming.difficultyLevel;
    await draft.save();

    return this.toDraftResponse(draft);
  }

  async publishDraft(
    draftId: string,
    dto: PublishDraftDto,
    userId: string,
  ): Promise<{ mockTestId: string; draft: DraftResponseDto }> {
    if (!Types.ObjectId.isValid(draftId)) {
      throw new BadRequestException('Invalid draft ID');
    }

    const draft = await this.draftModel.findOneAndUpdate(
      { _id: draftId, status: 'REVIEW' },
      { $set: { status: 'PUBLISHING' } },
      { new: true },
    );
    if (!draft) {
      throw new BadRequestException({
        message: 'Draft is not editable',
        error: 'DRAFT_NOT_EDITABLE',
      });
    }

    try {
      return await this.finalizePublish(draft, dto, userId);
    } catch (error) {
      await this.draftModel
        .updateOne(
          { _id: draft._id, status: 'PUBLISHING' },
          { $set: { status: 'REVIEW' } },
        )
        .exec();
      throw error;
    }
  }

  private async finalizePublish(
    draft: FullMockTestDraftDocument,
    dto: PublishDraftDto,
    userId: string,
  ): Promise<{ mockTestId: string; draft: DraftResponseDto }> {
    const snapshot = draft.examSnapshot;
    const ordered = [...draft.questions].sort(
      (a, b) => a.position - b.position,
    );
    this.assertNoDuplicateQuestions(ordered);
    if (
      snapshot.totalQuestions != null &&
      ordered.length !== snapshot.totalQuestions
    ) {
      throw new BadRequestException({
        message: `Paper has ${ordered.length} questions but the exam requires ${snapshot.totalQuestions}`,
        error: 'PAPER_INCOMPLETE',
        details: {
          expected: snapshot.totalQuestions,
          actual: ordered.length,
        },
      });
    }
    const questionIds = ordered.map(q => q.question);
    await this.assertQuestionsEligibleForPublish(questionIds);

    const subjectConfig = snapshot.subjects.map(row => {
      const indices = ordered
        .map((q, i) => ({ q, i }))
        .filter(entry => entry.q.subject.toString() === row.subject.toString())
        .map(entry => entry.i);
      const start = indices.length ? Math.min(...indices) : 0;
      const end = indices.length ? Math.max(...indices) : -1;
      return {
        subject: row.subject,
        name: row.name,
        numberOfQuestions: row.numberOfQuestions,
        marksPerQuestion: row.marksPerQuestion,
        hasNegativeMarking: row.hasNegativeMarking,
        negativeMarksPerQuestion: row.negativeMarksPerQuestion,
        sessionTime: row.sessionTime,
        questionStartIndex: start,
        questionEndIndex: end,
      };
    });

    const durationInMinutes = snapshot.isSessionWise
      ? snapshot.subjects.reduce((sum, row) => sum + (row.sessionTime || 0), 0)
      : snapshot.duration || 0;

    const firstSubject = snapshot.subjects[0];

    const mockTest = await this.mockTestModel.create({
      paperType: PaperType.FULL_EXAM,
      totalQuestions: snapshot.totalQuestions,
      durationInMinutes,
      exam: draft.exam,
      title: dto.title || snapshot.name,
      description: dto.description,
      generationMode: 'STATIC',
      questionIds,
      marksPerQuestion: firstSubject?.marksPerQuestion ?? 1,
      negativeMarking: firstSubject?.hasNegativeMarking
        ? firstSubject.negativeMarksPerQuestion
        : 0,
      totalMarks: snapshot.totalMarks,
      isSessionWise: snapshot.isSessionWise,
      subjectConfig,
      passingScore: dto.passingScore,
      allowRetake: dto.allowRetake ?? true,
      shuffleOptions: dto.shuffleOptions ?? false,
      showResultsImmediately: dto.showResultsImmediately ?? true,
      isActive: true,
      isDeleted: false,
      createdBy: new Types.ObjectId(userId),
    });

    await this.questionModel.updateMany(
      { _id: { $in: questionIds } },
      {
        $inc: { fullMockUsageCount: 1 },
        $set: { lastUsedInFullMockAt: new Date() },
      },
    );

    draft.status = 'PUBLISHED';
    draft.publishedMockTestId = mockTest._id as Types.ObjectId;
    await draft.save();

    return {
      mockTestId: mockTest.id || mockTest._id.toString(),
      draft: await this.toDraftResponse(draft),
    };
  }

  async discardDraft(draftId: string): Promise<void> {
    const draft = await this.loadDraft(draftId);
    if (draft.status === 'PUBLISHED' || draft.status === 'PUBLISHING') {
      throw new BadRequestException({
        message: 'Published drafts cannot be discarded',
        error: 'DRAFT_NOT_EDITABLE',
      });
    }
    draft.status = 'DISCARDED';
    await draft.save();
  }

  async listPublished(
    examId: string | undefined,
    page = 1,
    limit = 10,
    userId?: string,
    includeInactive = false,
  ): Promise<{
    data: FullMockTestListItemDto[];
    pagination: PaginationMetaDto;
  }> {
    if (examId && !Types.ObjectId.isValid(examId)) {
      throw new BadRequestException('Invalid exam ID');
    }

    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    const query: FilterQuery<MockTestDocument> = {
      paperType: PaperType.FULL_EXAM,
    };
    if (examId) {
      query.exam = new Types.ObjectId(examId);
    }
    if (!includeInactive) {
      query.isActive = true;
    }

    const [tests, total] = await Promise.all([
      this.mockTestModel
        .find(query)
        .populate('exam', '_id name description')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      this.mockTestModel.countDocuments(query).exec(),
    ]);

    let userActions = new Map<
      string,
      { action: UserAttemptAction; resumeAttemptId?: string }
    >();
    if (userId) {
      userActions = await this.mockTestsService.getUserAttemptActions(
        tests.map(t => t._id.toString()),
        userId,
      );
    }

    const totalPages = Math.ceil(total / validLimit) || 0;

    return {
      data: tests.map(test => {
        const entry = userActions.get(test._id.toString()) || {
          action: UserAttemptAction.START,
        };
        return this.toListItem(test, entry.action, entry.resumeAttemptId);
      }),
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1,
      },
    };
  }

  async findOnePublished(
    id: string,
    userId?: string,
  ): Promise<FullMockTestListItemDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid mock test ID');
    }

    const test = await this.mockTestModel
      .findOne({
        _id: id,
        paperType: PaperType.FULL_EXAM,
      })
      .populate('exam', '_id name description')
      .exec();

    if (!test) {
      throw new NotFoundException('Full mock test not found');
    }

    let action = UserAttemptAction.START;
    let resumeAttemptId: string | undefined;
    if (userId) {
      const actions = await this.mockTestsService.getUserAttemptActions(
        [test._id.toString()],
        userId,
      );
      const entry = actions.get(test._id.toString());
      action = entry?.action || UserAttemptAction.START;
      resumeAttemptId = entry?.resumeAttemptId;
    }

    return this.toListItem(test, action, resumeAttemptId);
  }

  private async loadDraft(draftId: string): Promise<FullMockTestDraftDocument> {
    if (!Types.ObjectId.isValid(draftId)) {
      throw new BadRequestException('Invalid draft ID');
    }
    const draft = await this.draftModel.findById(draftId).exec();
    if (!draft || draft.status === 'DISCARDED') {
      throw new NotFoundException('Draft not found');
    }
    return draft;
  }

  private async toDraftResponse(
    draft: FullMockTestDraftDocument,
  ): Promise<DraftResponseDto> {
    const questionIds = draft.questions.map(q => q.question);
    const docs = questionIds.length
      ? await this.questionModel
          .find({ _id: { $in: questionIds } })
          .select('-correctAnswer -explanation')
          .lean()
          .exec()
      : [];
    const byId = new Map(docs.map(q => [q._id.toString(), q]));

    const subjects = draft.examSnapshot.subjects.map(row => {
      const blockQuestions = draft.questions
        .filter(q => q.subject.toString() === row.subject.toString())
        .sort((a, b) => a.position - b.position)
        .map(q => {
          const doc = byId.get(q.question.toString());
          const safe = doc
            ? this.toSafeQuestion(doc)
            : {
                _id: q.question.toString(),
                questionText: {
                  en: { text: null, imageUrl: null },
                  ml: { text: null, imageUrl: null },
                },
                options: [],
                subject: q.subject.toString(),
                topic: q.topic?.toString(),
                difficultyLevel: q.difficultyLevel,
              };
          return {
            ...safe,
            position: q.position,
            marksPerQuestion: q.marksPerQuestion,
            negativeMarking: q.negativeMarking,
            replacedFrom: q.replacedFrom?.toString(),
          };
        });

      return {
        subjectId: row.subject.toString(),
        name: row.name,
        numberOfQuestions: row.numberOfQuestions,
        marksPerQuestion: row.marksPerQuestion,
        hasNegativeMarking: row.hasNegativeMarking,
        negativeMarksPerQuestion: row.negativeMarksPerQuestion,
        sessionTime: row.sessionTime,
        questions: blockQuestions,
      };
    });

    return {
      id: draft.id || draft._id.toString(),
      examId: draft.exam.toString(),
      status: draft.status,
      examSnapshot: {
        name: draft.examSnapshot.name,
        description: draft.examSnapshot.description,
        duration: draft.examSnapshot.duration,
        totalQuestions: draft.examSnapshot.totalQuestions,
        totalMarks: draft.examSnapshot.totalMarks,
        isSessionWise: draft.examSnapshot.isSessionWise,
      },
      subjects,
      publishedMockTestId: draft.publishedMockTestId?.toString(),
      createdAt: draft.createdAt as Date,
      updatedAt: draft.updatedAt as Date,
    };
  }

  private toListItem(
    test: MockTestDocument,
    userAttemptAction: UserAttemptAction,
    resumeAttemptId?: string,
  ): FullMockTestListItemDto {
    const examDoc = test.exam as unknown as PopulatedDocument;
    return {
      id: test.id || test._id.toString(),
      title: test.title,
      description: test.description,
      totalQuestions: test.totalQuestions,
      durationInMinutes: test.durationInMinutes,
      totalMarks: test.totalMarks,
      isSessionWise: test.isSessionWise || false,
      exam: test.exam
        ? {
            id: examDoc?._id?.toString() || test.exam.toString(),
            name: examDoc?.name || '',
            description: examDoc?.description,
          }
        : null,
      subjectConfig: (test.subjectConfig || []).map(row => ({
        subject: row.subject.toString(),
        name: row.name,
        numberOfQuestions: row.numberOfQuestions,
        marksPerQuestion: row.marksPerQuestion,
        hasNegativeMarking: row.hasNegativeMarking,
        negativeMarksPerQuestion: row.negativeMarksPerQuestion,
        sessionTime: row.sessionTime,
        questionStartIndex: row.questionStartIndex,
        questionEndIndex: row.questionEndIndex,
      })),
      marksPerQuestion: test.marksPerQuestion,
      negativeMarking: test.negativeMarking,
      passingScore: test.passingScore,
      allowRetake: test.allowRetake,
      shuffleOptions: test.shuffleOptions,
      showResultsImmediately: test.showResultsImmediately,
      isActive: test.isActive,
      createdAt: test.createdAt as Date,
      updatedAt: test.updatedAt as Date,
      userAttemptAction,
      resumeAttemptId,
    };
  }

  private extractImageUrl(
    imageMetadata: { url?: string } | undefined | null,
  ): string | null {
    return imageMetadata?.url || null;
  }

  private toSafeQuestion(q: {
    _id: { toString(): string };
    questionText?: {
      en?: { text?: string; image?: { url?: string } };
      ml?: { text?: string; image?: { url?: string } };
    };
    optionType?: string;
    options?: Array<{
      id: string;
      type: string;
      en?: string | null;
      ml?: string | null;
      image?: { url?: string };
    }>;
    subject?: { toString(): string };
    topic?: { toString(): string };
    difficultyLevel?: string;
  }): SafeQuestionDto {
    return {
      _id: q._id.toString(),
      questionText: {
        en: {
          text: q.questionText?.en?.text || null,
          imageUrl: this.extractImageUrl(q.questionText?.en?.image),
        },
        ml: {
          text: q.questionText?.ml?.text || null,
          imageUrl: this.extractImageUrl(q.questionText?.ml?.image),
        },
      },
      optionType: q.optionType,
      options:
        q.options?.map(opt => ({
          id: opt.id,
          type: opt.type,
          en: opt.en,
          ml: opt.ml,
          imageUrl: this.extractImageUrl(opt.image),
        })) || [],
      subject: q.subject?.toString(),
      topic: q.topic?.toString(),
      difficultyLevel: q.difficultyLevel,
    };
  }

  private async assertQuestionsEligibleForPublish(
    questionIds: Array<{ toString(): string }>,
  ): Promise<void> {
    if (questionIds.length === 0) {
      throw new BadRequestException({
        message: 'Draft has no questions to publish',
        error: 'PAPER_INCOMPLETE',
      });
    }

    const live = await this.questionModel
      .find({
        _id: { $in: questionIds },
        isActive: true,
        difficultyLevel: { $in: ['easy', 'medium', 'hard'] },
      })
      .select('_id')
      .lean()
      .exec();

    if (live.length === questionIds.length) {
      return;
    }

    const liveIds = new Set(live.map(q => q._id.toString()));
    const missing = questionIds
      .map(id => id.toString())
      .filter(id => !liveIds.has(id));

    throw new BadRequestException({
      message:
        'One or more questions are no longer eligible (inactive, deleted, or missing difficulty). Replace them before publishing.',
      error: 'QUESTION_NOT_ELIGIBLE',
      details: { questionIds: missing },
    });
  }

  private assertNoDuplicateQuestions(
    questions: Array<{ question?: { toString(): string }; position?: number }>,
  ): void {
    const positionsById = new Map<string, number[]>();
    questions.forEach((row, index) => {
      const id = row.question?.toString();
      if (!id) {
        return;
      }
      const positions = positionsById.get(id) || [];
      positions.push(row.position ?? index);
      positionsById.set(id, positions);
    });

    const duplicates = [...positionsById.entries()]
      .filter(([, positions]) => positions.length > 1)
      .map(([questionId, positions]) => ({
        questionId,
        positions,
        displayPositions: positions.map(position => position + 1),
      }));

    if (duplicates.length === 0) {
      return;
    }

    const summary = duplicates
      .map(
        row =>
          `question ${row.questionId} at positions ${row.displayPositions.join(', ')}`,
      )
      .join('; ');

    throw new BadRequestException({
      message: `This paper contains duplicate questions. ${summary}. Replace the extra copies before publishing.`,
      error: 'DUPLICATE_QUESTION',
      details: duplicates,
    });
  }

  /**
   * Legacy exams may store a bare ObjectId, or a row with a missing `subject`.
   */
  private subjectIdFromRow(row: unknown): string | undefined {
    if (row == null) {
      return undefined;
    }
    if (typeof row === 'string') {
      return Types.ObjectId.isValid(row) ? row : undefined;
    }
    if (row instanceof Types.ObjectId) {
      return row.toString();
    }
    if (typeof row === 'object' && 'subject' in row) {
      const subject = (row as { subject?: unknown }).subject;
      if (subject == null) {
        return undefined;
      }
      if (typeof subject === 'string') {
        return Types.ObjectId.isValid(subject) ? subject : undefined;
      }
      if (typeof (subject as { toString?: unknown }).toString === 'function') {
        const id = (subject as { toString: () => string }).toString();
        return Types.ObjectId.isValid(id) ? id : undefined;
      }
    }
    return undefined;
  }
}
