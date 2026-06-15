import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CallCenter } from './call-center';

describe('CallCenter', () => {
  let component: CallCenter;
  let fixture: ComponentFixture<CallCenter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CallCenter],
    }).compileComponents();

    fixture = TestBed.createComponent(CallCenter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
