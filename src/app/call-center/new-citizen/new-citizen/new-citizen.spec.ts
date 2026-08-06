import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { NewCitizen } from './new-citizen';

describe('NewCitizen', () => {
  let component: NewCitizen;
  let fixture: ComponentFixture<NewCitizen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewCitizen],
      providers: [
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

    fixture = TestBed.createComponent(NewCitizen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
