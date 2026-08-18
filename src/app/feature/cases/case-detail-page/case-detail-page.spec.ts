/*
 * CaseDetailPageComponent spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - ngOnInit: no caseId -> notFound error + all loading flags false
 *   - ngOnInit: with caseId -> loads detail, timeline and actions in parallel
 *   - loadCaseDetail: success / 404 / other error branches
 *   - loadTimeline: success / 404 / other error branches
 *   - loadActions: success / error (non-fatal)
 *   - openActionModal: ASSIGN/REASSIGN route to handler picker; other actions open transition modal
 *   - closeActionModal / openHandlerPicker / closeHandlerPicker / selectHandler / retryLoadHandlers
 *   - confirmAssign: guard clauses, REASSIGN comment required, success reloads timeline+actions,
 *     409 -> conflict key + server message logged, generic failure
 *   - submitAction: guard clauses, comment/resolution required, AWAIT_INFO handling, success,
 *     409 -> conflict key + server message logged, generic failure
 *   - goBack / goToCitizenProfile navigation
 *   - filteredHandlers computed (case-insensitive displayName/email filtering)
 *   - Template helpers: statusBadgeClass, priorityBadgeClass, isOverdue, formatDateTime, isCreationEvent
 *
 * SKIPPED (with reason):
 *   - Full template DOM interactions (modal button clicks): exercised via the underlying
 *     component methods; DOM-level coverage adds low value for this view-heavy component.
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CaseDetailPageComponent } from './case-detail-page';
import { CaseService } from '../../../../core/services/case.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { TranslocoService } from '@jsverse/transloco';
import { AuthTokenService } from '../../../auth/auth-token.service';
import { NoteService } from '../../../../core/services/note.service';
import { AttachmentService } from '../../../../core/services/attachment.service';
import {
  CaseResponse, CaseStatus, Priority, CaseActionResponse,
  HandlerResponse, StatusHistoryResponse
} from '../../../../core/models/case.models';

const mockCase: CaseResponse = {
  id: 'case-1',
  caseNumber: 'CASE-2026-0001',
  subject: 'Broken tap',
  description: 'Water leaking in kitchen',
  type: 'REQUEST',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  channel: 'PHONE',
  resolutionSummary: null,
  dueAt: null,
  citizenId: 'cit-1',
  citizenFullName: 'John Doe',
  citizenNationalId: '1234567890',
  citizenPhone: '0100000000',
  categoryId: 'cat-1',
  categoryNameEn: 'Water',
  categoryNameAr: 'مياه',
  departmentId: 'dep-1',
  departmentNameEn: 'Utilities',
  departmentNameAr: 'مرافق',
  createdByUserId: 'u-1',
  createdByDisplayName: 'Agent One',
  assignedToUserId: 'u-2',
  assignedToDisplayName: 'Handler Two',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-02T12:00:00Z',
  resolvedAt: null,
  closedAt: null
};

const mockTimeline: StatusHistoryResponse[] = [
  {
    id: 'th-1',
    fromStatus: null,
    toStatus: 'NEW',
    action: 'CREATE',
    comment: null,
    createdAt: '2026-01-01T10:00:00Z',
    changedByUserId: 'u-1',
    changedByDisplayName: 'Agent One'
  }
];

const assignAction: CaseActionResponse = {
  action: 'ASSIGN',
  labelKey: 'cases.actions.assign',
  resultingStatus: 'ASSIGNED',
  requiresComment: false,
  requiresResolutionSummary: false
};

const reassignAction: CaseActionResponse = {
  action: 'REASSIGN',
  labelKey: 'cases.actions.reassign',
  resultingStatus: 'ASSIGNED',
  requiresComment: true,
  requiresResolutionSummary: false
};

const resolveAction: CaseActionResponse = {
  action: 'RESOLVE',
  labelKey: 'cases.actions.resolve',
  resultingStatus: 'RESOLVED',
  requiresComment: false,
  requiresResolutionSummary: true
};

const awaitInfoAction: CaseActionResponse = {
  action: 'AWAIT_INFO',
  labelKey: 'cases.actions.awaitInfo',
  resultingStatus: 'AWAITING_INFO',
  requiresComment: false,
  requiresResolutionSummary: false
};

const mockHandlers: HandlerResponse[] = [
  { id: 'h-1', displayName: 'Alice Admin', email: 'alice@example.com' },
  { id: 'h-2', displayName: 'Bob Builder', email: 'bob@example.com' }
];

describe('CaseDetailPageComponent', () => {
  let fixture: ComponentFixture<CaseDetailPageComponent>;
  let component: CaseDetailPageComponent;

  let caseService: {
    getCaseById: ReturnType<typeof vi.fn>;
    getCaseTimeline: ReturnType<typeof vi.fn>;
    getCaseActions: ReturnType<typeof vi.fn>;
    getHandlers: ReturnType<typeof vi.fn>;
    transitionCase: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let transloco: { translate: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };

  let caseId: string | null;

  beforeEach(async () => {
    caseId = 'case-1';

    caseService = {
      getCaseById: vi.fn().mockReturnValue(of(mockCase)),
      getCaseTimeline: vi.fn().mockReturnValue(of(mockTimeline)),
      getCaseActions: vi.fn().mockReturnValue(of([assignAction, resolveAction])),
      getHandlers: vi.fn().mockReturnValue(of(mockHandlers)),
      transitionCase: vi.fn()
    };

    router = { navigate: vi.fn() };
    transloco = { translate: vi.fn((key: string) => key) };
    logger = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CaseDetailPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => caseId } } }
        },
        { provide: Router, useValue: router },
        { provide: CaseService, useValue: caseService },
        { provide: TranslocoService, useValue: transloco },
        {
          provide: AuthTokenService,
          useValue: {
            getToken: vi.fn().mockReturnValue('jwt'),
            getUserData: vi.fn().mockReturnValue(null),
            saveToken: vi.fn(),
            saveAuthData: vi.fn(),
            clearAuthData: vi.fn()
          }
        },
        {
          provide: NoteService,
          useValue: {
            getNotesByCaseId: vi.fn().mockReturnValue(of([])),
            addNote: vi.fn().mockReturnValue(of({})),
            deleteNote: vi.fn().mockReturnValue(of(undefined))
          }
        },
        {
          provide: AttachmentService,
          useValue: {
            getAttachmentsByCaseId: vi.fn().mockReturnValue(of([])),
            uploadAttachment: vi.fn().mockReturnValue(of({})),
            deleteAttachment: vi.fn().mockReturnValue(of(undefined)),
            downloadAttachment: vi.fn().mockReturnValue(of(new Blob()))
          }
        },
        { provide: LoggerService, useValue: logger }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CaseDetailPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('handles a missing case id by showing notFound and disabling all loaders', () => {
      caseId = null;
      component.ngOnInit();

      expect(component.loadError()).toBe('cases.detail.notFound');
      expect(component.isLoading()).toBe(false);
      expect(component.isTimelineLoading()).toBe(false);
      expect(component.isActionsLoading()).toBe(false);
      expect(caseService.getCaseById).not.toHaveBeenCalled();
      expect(caseService.getCaseTimeline).not.toHaveBeenCalled();
      expect(caseService.getCaseActions).not.toHaveBeenCalled();
    });

    it('loads detail, timeline and actions in parallel when an id is present', () => {
      component.ngOnInit();

      expect(caseService.getCaseById).toHaveBeenCalledWith('case-1');
      expect(caseService.getCaseTimeline).toHaveBeenCalledWith('case-1');
      expect(caseService.getCaseActions).toHaveBeenCalledWith('case-1');
      expect(component.caseDetail()).toEqual(mockCase);
      expect(component.timeline()).toEqual(mockTimeline);
      expect(component.availableActions()).toEqual([assignAction, resolveAction]);
      expect(component.isLoading()).toBe(false);
      expect(component.isTimelineLoading()).toBe(false);
      expect(component.isActionsLoading()).toBe(false);
    });
  });

  describe('loadCaseDetail error branches', () => {
    it('shows notFound on a 404', () => {
      caseService.getCaseById.mockReturnValue(throwError(() => ({ status: 404 })));
      component.ngOnInit();

      expect(component.loadError()).toBe('cases.detail.notFound');
      expect(component.isLoading()).toBe(false);
    });

    it('shows the generic load error on other failures', () => {
      caseService.getCaseById.mockReturnValue(throwError(() => ({ status: 500 })));
      component.ngOnInit();

      expect(component.loadError()).toBe('cases.detail.loadError');
      expect(component.isLoading()).toBe(false);
    });
  });

  describe('loadTimeline error branches', () => {
    it('shows notFound on a 404', () => {
      caseService.getCaseTimeline.mockReturnValue(throwError(() => ({ status: 404 })));
      component.ngOnInit();

      expect(component.timelineError()).toBe('cases.detail.notFound');
      expect(component.isTimelineLoading()).toBe(false);
    });

    it('shows the timeline load error on other failures', () => {
      caseService.getCaseTimeline.mockReturnValue(throwError(() => ({ status: 500 })));
      component.ngOnInit();

      expect(component.timelineError()).toBe('cases.detail.timelineLoadError');
      expect(component.isTimelineLoading()).toBe(false);
    });
  });

  describe('loadActions error branch', () => {
    it('is non-fatal: sets actionsError but keeps page usable', () => {
      caseService.getCaseActions.mockReturnValue(throwError(() => ({ status: 500 })));
      component.ngOnInit();

      expect(component.actionsError()).toBe('cases.detail.actionsLoadError');
      expect(component.isActionsLoading()).toBe(false);
      expect(component.caseDetail()).toEqual(mockCase);
    });
  });

  describe('openActionModal', () => {
    it('routes ASSIGN to the handler picker instead of the transition modal', () => {
      component.ngOnInit();
      component.openActionModal(assignAction);

      expect(component.handlerPickerAction()).toEqual(assignAction);
      expect(component.isHandlerPickerOpen()).toBe(true);
      expect(component.pendingAction()).toBeNull();
      expect(caseService.getHandlers).toHaveBeenCalled();
    });

    it('routes REASSIGN to the handler picker', () => {
      component.ngOnInit();
      component.openActionModal(reassignAction);

      expect(component.handlerPickerAction()).toEqual(reassignAction);
      expect(component.isHandlerPickerOpen()).toBe(true);
      expect(component.pendingAction()).toBeNull();
    });

    it('opens the transition modal for non-assign actions and resets inputs', () => {
      component.transitionComment = 'dirty';
      component.transitionResolution = 'dirty';
      component.transitionError.set('dirty');

      component.openActionModal(resolveAction);

      expect(component.pendingAction()).toEqual(resolveAction);
      expect(component.isHandlerPickerOpen()).toBe(false);
      expect(component.transitionComment).toBe('');
      expect(component.transitionResolution).toBe('');
      expect(component.transitionError()).toBeNull();
      expect(caseService.getHandlers).not.toHaveBeenCalled();
    });
  });

  describe('closeActionModal', () => {
    it('clears the pending action', () => {
      component.pendingAction.set(resolveAction);
      component.closeActionModal();
      expect(component.pendingAction()).toBeNull();
    });
  });

  describe('handler picker', () => {
    it('openHandlerPicker loads handlers and resets state', () => {
      component.handlerSearchQuery.set('stale');
      component.selectedHandlerId.set('stale');

      component.openHandlerPicker();

      expect(component.isHandlerPickerOpen()).toBe(true);
      expect(component.isLoadingHandlers()).toBe(false);
      expect(component.handlers()).toEqual(mockHandlers);
      expect(component.handlersLoadError()).toBeNull();
      expect(component.handlerSearchQuery()).toBe('');
      expect(component.selectedHandlerId()).toBeNull();
      expect(caseService.getHandlers).toHaveBeenCalled();
    });

    it('openHandlerPicker surfaces a load error when handlers fail', () => {
      caseService.getHandlers.mockReturnValue(throwError(() => ({ status: 500 })));

      component.openHandlerPicker();

      expect(component.isLoadingHandlers()).toBe(false);
      expect(component.handlersLoadError()).toBe('cases.detail.handlersLoadError');
      expect(component.handlers()).toEqual([]);
    });

    it('closeHandlerPicker resets all picker state', () => {
      component.isHandlerPickerOpen.set(true);
      component.handlerPickerAction.set(reassignAction);
      component.handlers.set(mockHandlers);
      component.selectedHandlerId.set('h-1');
      component.assignComment = 'dirty';
      component.assignError.set('dirty');
      component.isSubmittingAssign.set(true);

      component.closeHandlerPicker();

      expect(component.isHandlerPickerOpen()).toBe(false);
      expect(component.handlerPickerAction()).toBeNull();
      expect(component.handlers()).toEqual([]);
      expect(component.selectedHandlerId()).toBeNull();
      expect(component.assignComment).toBe('');
      expect(component.assignError()).toBeNull();
      expect(component.isSubmittingAssign()).toBe(false);
    });

    it('selectHandler records the chosen handler id', () => {
      component.selectHandler('h-2');
      expect(component.selectedHandlerId()).toBe('h-2');
    });

    it('retryLoadHandlers reloads handlers when a case id exists', () => {
      component.openHandlerPicker();
      expect(caseService.getHandlers).toHaveBeenCalledTimes(1);

      component.retryLoadHandlers();
      expect(caseService.getHandlers).toHaveBeenCalledTimes(2);
    });

    it('retryLoadHandlers is a no-op without a case id', () => {
      caseId = null;
      component.openHandlerPicker();
      const before = caseService.getHandlers.mock.calls.length;

      component.retryLoadHandlers();
      expect(caseService.getHandlers.mock.calls.length).toBe(before);
    });
  });

  describe('confirmAssign', () => {
    it('does nothing without a case id, handler id or action', () => {
      component.caseDetail.set(mockCase);
      component.confirmAssign();
      expect(caseService.transitionCase).not.toHaveBeenCalled();

      component.caseDetail.set(null);
      component.selectedHandlerId.set('h-1');
      component.handlerPickerAction.set(assignAction);
      component.confirmAssign();
      expect(caseService.transitionCase).not.toHaveBeenCalled();
    });

    it('requires a comment for REASSIGN', () => {
      component.caseDetail.set(mockCase);
      component.selectedHandlerId.set('h-1');
      component.handlerPickerAction.set(reassignAction);
      component.assignComment = '   ';

      component.confirmAssign();

      expect(component.assignError()).toBe('cases.detail.commentRequired');
      expect(caseService.transitionCase).not.toHaveBeenCalled();
    });

    it('submits ASSIGN with assignedToUserId and reloads timeline + actions on success', () => {
      const updated = { ...mockCase, status: 'ASSIGNED' as CaseStatus };
      caseService.transitionCase.mockReturnValue(of(updated));
      component.ngOnInit();
      component.caseDetail.set(mockCase);
      component.selectedHandlerId.set('h-1');
      component.handlerPickerAction.set(assignAction);

      component.confirmAssign();

      expect(caseService.transitionCase).toHaveBeenCalledWith('case-1', {
        action: 'ASSIGN',
        assignedToUserId: 'h-1'
      });
      expect(component.caseDetail()).toEqual(updated);
      expect(component.isHandlerPickerOpen()).toBe(false);
      expect(caseService.getCaseTimeline).toHaveBeenCalledTimes(2);
      expect(caseService.getCaseActions).toHaveBeenCalledTimes(2);
    });

    it('submits REASSIGN with a trimmed comment', () => {
      caseService.transitionCase.mockReturnValue(of(mockCase));
      component.caseDetail.set(mockCase);
      component.selectedHandlerId.set('h-2');
      component.handlerPickerAction.set(reassignAction);
      component.assignComment = '  workload balance  ';

      component.confirmAssign();

      expect(caseService.transitionCase).toHaveBeenCalledWith('case-1', {
        action: 'REASSIGN',
        assignedToUserId: 'h-2',
        comment: 'workload balance'
      });
    });

    it('maps a 409 assign conflict to the conflict key and logs the server message (M-26)', () => {
      caseService.transitionCase.mockReturnValue(
        throwError(() => ({ status: 409, error: { message: 'Assignee unavailable' } }))
      );
      component.caseDetail.set(mockCase);
      component.selectedHandlerId.set('h-1');
      component.handlerPickerAction.set(assignAction);

      component.confirmAssign();

      expect(component.assignError()).toBe('cases.detail.assignConflict');
      expect(component.isSubmittingAssign()).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('falls back to the conflict key when a 409 has no server message', () => {
      caseService.transitionCase.mockReturnValue(throwError(() => ({ status: 409, error: {} })));
      component.caseDetail.set(mockCase);
      component.selectedHandlerId.set('h-1');
      component.handlerPickerAction.set(assignAction);

      component.confirmAssign();

      expect(component.assignError()).toBe('cases.detail.assignConflict');
    });

    it('shows a generic failure message for non-conflict errors', () => {
      caseService.transitionCase.mockReturnValue(throwError(() => ({ status: 500 })));
      component.caseDetail.set(mockCase);
      component.selectedHandlerId.set('h-1');
      component.handlerPickerAction.set(assignAction);

      component.confirmAssign();

      expect(component.assignError()).toBe('cases.detail.assignFailed');
    });
  });

  describe('submitAction', () => {
    it('does nothing without a pending action or case id', () => {
      component.submitAction();
      expect(caseService.transitionCase).not.toHaveBeenCalled();

      component.pendingAction.set(resolveAction);
      component.submitAction();
      expect(caseService.transitionCase).not.toHaveBeenCalled();
    });

    it('requires a comment when the action requires one', () => {
      const action = { ...reassignAction, requiresComment: true, requiresResolutionSummary: false };
      component.caseDetail.set(mockCase);
      component.pendingAction.set(action);
      component.transitionComment = '   ';

      component.submitAction();

      expect(component.transitionError()).toBe('cases.detail.commentRequired');
      expect(caseService.transitionCase).not.toHaveBeenCalled();
    });

    it('requires a resolution summary when the action requires one', () => {
      component.caseDetail.set(mockCase);
      component.pendingAction.set(resolveAction);
      component.transitionResolution = '   ';

      component.submitAction();

      expect(component.transitionError()).toBe('cases.detail.resolutionRequired');
      expect(caseService.transitionCase).not.toHaveBeenCalled();
    });

    it('requires a comment for AWAIT_INFO even when requiresComment is false', () => {
      component.caseDetail.set(mockCase);
      component.pendingAction.set(awaitInfoAction);
      component.transitionComment = '   ';

      component.submitAction();

      expect(component.transitionError()).toBe('cases.detail.commentRequired');
      expect(caseService.transitionCase).not.toHaveBeenCalled();
    });

    it('submits the transition and reloads timeline + actions on success', () => {
      const updated = { ...mockCase, status: 'IN_PROGRESS' as CaseStatus };
      caseService.transitionCase.mockReturnValue(of(updated));
      component.ngOnInit();
      component.caseDetail.set(mockCase);
      component.pendingAction.set({ ...awaitInfoAction, requiresComment: true });
      component.transitionComment = '  please send bill copy  ';

      component.submitAction();

      expect(caseService.transitionCase).toHaveBeenCalledWith('case-1', {
        action: 'AWAIT_INFO',
        comment: 'please send bill copy'
      });
      expect(component.caseDetail()).toEqual(updated);
      expect(component.pendingAction()).toBeNull();
      expect(caseService.getCaseTimeline).toHaveBeenCalledTimes(2);
      expect(caseService.getCaseActions).toHaveBeenCalledTimes(2);
    });

    it('includes the resolution summary when required', () => {
      caseService.transitionCase.mockReturnValue(of(mockCase));
      component.caseDetail.set(mockCase);
      component.pendingAction.set(resolveAction);
      component.transitionResolution = '  fixed  ';

      component.submitAction();

      expect(caseService.transitionCase).toHaveBeenCalledWith('case-1', {
        action: 'RESOLVE',
        resolutionSummary: 'fixed'
      });
    });

    it('includes a comment for AWAIT_INFO when a comment is provided', () => {
      caseService.transitionCase.mockReturnValue(of(mockCase));
      component.caseDetail.set(mockCase);
      component.pendingAction.set(awaitInfoAction);
      component.transitionComment = 'please reply';

      component.submitAction();

      expect(caseService.transitionCase).toHaveBeenCalledWith('case-1', {
        action: 'AWAIT_INFO',
        comment: 'please reply'
      });
    });

    it('maps a 409 transition conflict to the conflict key and logs the server message (M-26)', () => {
      caseService.transitionCase.mockReturnValue(
        throwError(() => ({ status: 409, error: { message: 'Illegal transition' } }))
      );
      component.caseDetail.set(mockCase);
      component.pendingAction.set({ ...assignAction, requiresComment: true });
      component.transitionComment = 'ok';

      component.submitAction();

      expect(component.transitionError()).toBe('cases.detail.transitionConflict');
      expect(component.isSubmittingAction()).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('falls back to the conflict key when a 409 has no server message', () => {
      caseService.transitionCase.mockReturnValue(throwError(() => ({ status: 409, error: {} })));
      component.caseDetail.set(mockCase);
      component.pendingAction.set({ ...assignAction, requiresComment: true });
      component.transitionComment = 'ok';

      component.submitAction();

      expect(component.transitionError()).toBe('cases.detail.transitionConflict');
    });

    it('shows a generic failure message for non-conflict errors', () => {
      caseService.transitionCase.mockReturnValue(throwError(() => ({ status: 500 })));
      component.caseDetail.set(mockCase);
      component.pendingAction.set({ ...assignAction, requiresComment: true });
      component.transitionComment = 'ok';

      component.submitAction();

      expect(component.transitionError()).toBe('cases.detail.transitionFailed');
    });
  });

  describe('navigation', () => {
    it('goBack navigates to /dashboard', () => {
      component.goBack();
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('goToCitizenProfile navigates to the citizen profile route', () => {
      component.goToCitizenProfile('cit-1');
      expect(router.navigate).toHaveBeenCalledWith(['/app/call-center/citizen', 'cit-1']);
    });
  });

  describe('filteredHandlers computed', () => {
    it('returns all handlers for an empty query', () => {
      component.handlers.set(mockHandlers);
      component.handlerSearchQuery.set('');
      expect(component.filteredHandlers()).toEqual(mockHandlers);
    });

    it('filters by displayName case-insensitively', () => {
      component.handlers.set(mockHandlers);
      component.handlerSearchQuery.set('ALICE');
      expect(component.filteredHandlers()).toEqual([mockHandlers[0]]);
    });

    it('filters by email', () => {
      component.handlers.set(mockHandlers);
      component.handlerSearchQuery.set('bob@example.com');
      expect(component.filteredHandlers()).toEqual([mockHandlers[1]]);
    });

    it('returns an empty list when nothing matches', () => {
      component.handlers.set(mockHandlers);
      component.handlerSearchQuery.set('zzz');
      expect(component.filteredHandlers()).toEqual([]);
    });
  });

  describe('template helper methods', () => {
    it('statusBadgeClass maps every status and falls back for unknown values', () => {
      const expected: Record<string, string> = {
        NEW: 'bg-blue-50 text-blue-700',
        ASSIGNED: 'bg-yellow-50 text-yellow-800',
        IN_PROGRESS: 'bg-indigo-50 text-indigo-700',
        AWAITING_INFO: 'bg-orange-50 text-orange-700',
        SUSPENDED: 'bg-gray-100 text-gray-600',
        RESOLVED: 'bg-emerald-50 text-emerald-700',
        CLOSED: 'bg-slate-100 text-slate-600',
        CANCELLED: 'bg-red-50 text-red-700'
      };

      (Object.keys(expected) as CaseStatus[]).forEach(status => {
        expect(component.statusBadgeClass(status)).toBe(expected[status]);
      });
      expect(component.statusBadgeClass('UNKNOWN' as CaseStatus)).toBe('bg-gray-100 text-gray-600');
    });

    it('priorityBadgeClass maps every priority and falls back for unknown values', () => {
      const expected: Record<string, string> = {
        LOW: 'bg-emerald-50 text-emerald-700',
        MEDIUM: 'bg-yellow-50 text-yellow-800',
        HIGH: 'bg-orange-50 text-orange-700',
        URGENT: 'bg-red-50 text-red-700'
      };

      (Object.keys(expected) as Priority[]).forEach(priority => {
        expect(component.priorityBadgeClass(priority)).toBe(expected[priority]);
      });
      expect(component.priorityBadgeClass('UNKNOWN' as Priority)).toBe('bg-gray-100 text-gray-600');
    });

    it('isOverdue returns false for null and future dates, true for past dates', () => {
      expect(component.isOverdue(null)).toBe(false);
      expect(component.isOverdue('2999-01-01T00:00:00Z')).toBe(false);
      expect(component.isOverdue('2020-01-01T00:00:00Z')).toBe(true);
    });

    it('formatDateTime returns an em dash for null and a formatted date otherwise', () => {
      expect(component.formatDateTime(null)).toBe('—');
      const formatted = component.formatDateTime('2026-01-01T10:00:00Z');
      expect(formatted).not.toBe('—');
      expect(formatted).toContain('2026');
    });

    it('isCreationEvent detects the initial CREATE event', () => {
      expect(component.isCreationEvent(mockTimeline[0])).toBe(true);
      expect(
        component.isCreationEvent({
          ...mockTimeline[0],
          fromStatus: 'NEW'
        })
      ).toBe(false);
    });
  });
});
