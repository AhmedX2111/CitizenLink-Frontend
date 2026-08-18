import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';

import { UserListComponent } from './user-list';
import { UserAdminService } from '../../../core/services/user-admin.service';
import { LoggerService } from '../../../core/services/logger.service';
import { UserResponse } from '../../../core/models/user.models';

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;

  let userService: { getUsers: ReturnType<typeof vi.fn>; deactivateUser: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };

  const user = { id: 'u-1', username: 'jdoe', displayName: 'John', email: 'j@x.com', role: 'HANDLER', active: true } as UserResponse;

  beforeEach(async () => {
    userService = { getUsers: vi.fn(), deactivateUser: vi.fn().mockReturnValue(of(user)) };
    logger = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [UserListComponent],
      providers: [
        { provide: UserAdminService, useValue: userService },
        { provide: LoggerService, useValue: logger },
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) => key,
            setActiveLang: () => undefined,
            getActiveLang: () => 'en',
            config: { reRenderOnLangChange: false },
            langChanges$: of('en'),
            _loadDependencies: () => of(undefined)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
  });

  const actionError = (): string | null =>
    (component as unknown as { actionError: () => string | null }).actionError();

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows an error toast when deactivation fails with a non-404 error (M-28)', () => {
    userService.deactivateUser.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'boom' } })));

    component.deactivateUser(user);

    expect(actionError()).toBe('admin.users.modal.deactivateFailed');
    expect(logger.error).toHaveBeenCalled();
  });

  it('relies on a reload without an error toast when the user is already gone (M-28)', () => {
    userService.deactivateUser.mockReturnValue(throwError(() => ({ status: 404 })));

    component.deactivateUser(user);

    expect(actionError()).toBeNull();
  });
});