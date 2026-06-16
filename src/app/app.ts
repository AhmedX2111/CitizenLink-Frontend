import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class App implements OnInit {
  private langService = inject(LanguageService);

  ngOnInit(): void {
    // LanguageService constructor fires on inject —
    // this ensures it is instantiated at app startup
    // so language is applied before any component renders.
  }
}