import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewCitizen } from './new-citizen';

describe('NewCitizen', () => {
  let component: NewCitizen;
  let fixture: ComponentFixture<NewCitizen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewCitizen],
    }).compileComponents();

    fixture = TestBed.createComponent(NewCitizen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
