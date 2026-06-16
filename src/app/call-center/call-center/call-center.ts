import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { PagedResponse } from '../../../core/models/case.models';
import { Citizen, PageResponse } from '../../../core/models/citizen.models';
import { CitizenService } from '../../../core/services/citizen.service';

@Component({
  selector: 'app-call-center',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './call-center.html',
  styleUrl: './call-center.css',
})
export class CallCenter {
  private citizenService = inject(CitizenService);
  private router = inject(Router);

  // Search state
  protected searchTerm = signal('');
  protected isLoading = signal(false);
  protected citizens = signal<Citizen[]>([]);
  protected pagination = signal<{
    currentPage: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
  } | null>(null);
  
  protected errorMessage = signal<string | null>(null);
  protected hasSearched = signal(false);

  // Computed values
  protected hasResults = computed(() => this.citizens().length > 0);
  protected noResults = computed(() => this.hasSearched() && !this.isLoading() && !this.hasResults());

  /**
   * Perform citizen search
   */
  onSearch(): void {
    const term = this.searchTerm().trim();
    
    if (!term) {
      this.errorMessage.set('Please enter a search term (name, national ID, or phone number)');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.hasSearched.set(true);

    this.citizenService.searchCitizens(term, 0, 20).subscribe({
      next: (response: PageResponse<Citizen>) => {
        this.citizens.set(response.content);
        this.pagination.set({
          currentPage: response.number,
          pageSize: response.size,
          totalElements: response.totalElements,
          totalPages: response.totalPages
        });
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Search error:', error);
        this.errorMessage.set('An error occurred while searching. Please try again.');
        this.isLoading.set(false);
        this.citizens.set([]);
      }
    });
  }

  /**
   * Navigate to citizen profile (Citizen profile)
   */
  viewCitizenProfile(citizenId: string): void {
    this.router.navigate(['/app/call-center/citizen', citizenId]);
  }

  /**
   * Navigate to create new citizen
   */
  createNewCitizen(): void {
    this.router.navigate(['/app/call-center/new-citizen']);
  }

  /**
   * Clear search and reset
   */
  clearSearch(): void {
    this.searchTerm.set('');
    this.citizens.set([]);
    this.hasSearched.set(false);
    this.errorMessage.set(null);
  }

  /**
   * Load next page
   */
  nextPage(): void {
    const currentPage = this.pagination()?.currentPage ?? 0;
    const totalPages = this.pagination()?.totalPages ?? 0;
    
    if (currentPage + 1 < totalPages) {
      this.loadPage(currentPage + 1);
    }
  }

  /**
   * Load previous page
   */
  previousPage(): void {
    const currentPage = this.pagination()?.currentPage ?? 0;
    
    if (currentPage > 0) {
      this.loadPage(currentPage - 1);
    }
  }

  private loadPage(page: number): void {
    const term = this.searchTerm();
    this.isLoading.set(true);
    
    this.citizenService.searchCitizens(term, page, 20).subscribe({
      next: (response: PageResponse<Citizen>) => {
        this.citizens.set(response.content);
        this.pagination.set({
          currentPage: response.number,
          pageSize: response.size,
          totalElements: response.totalElements,
          totalPages: response.totalPages
        });
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Page load error:', error);
        this.isLoading.set(false);
      }
    });
  }
}