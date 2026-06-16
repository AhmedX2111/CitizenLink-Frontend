import { CommonModule } from "@angular/common";
import { Component, OnInit, inject, signal } from "@angular/core";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { CitizenService } from "../../../core/services/citizen.service";
import { CitizenProfile as CitizenProfileData } from "../../../core/models/citizen.models";


@Component({
  selector: 'app-citizen-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './citizen-profile.html',
  styleUrls: ['./citizen-profile.css']
})
export class CitizenProfile implements OnInit {
  private citizenService = inject(CitizenService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected citizen = signal<CitizenProfileData | null>(null);
  protected isLoading = signal(true);
  protected errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCitizenProfile(id);
    } else {
      this.errorMessage.set('Citizen ID not found');
      this.isLoading.set(false);
    }
  }

  loadCitizenProfile(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    
    this.citizenService.getCitizenProfile(id).subscribe({
      next: (response: CitizenProfileData) => {
        this.citizen.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading citizen profile:', error);
        this.errorMessage.set('Failed to load citizen profile. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  createNewCase(): void {
    const citizen = this.citizen();
    if (citizen?.id) {
      this.router.navigate(['/cases/new'], { 
        queryParams: { citizenId: citizen.id } 
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/app/call-center']);
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-800',
      'ASSIGNED': 'bg-purple-100 text-purple-800',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
      'AWAITING_INFO': 'bg-orange-100 text-orange-800',
      'SUSPENDED': 'bg-gray-100 text-gray-800',
      'RESOLVED': 'bg-green-100 text-green-800',
      'CLOSED': 'bg-gray-200 text-gray-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  }

  getPriorityBadgeClass(priority: string): string {
    const priorityMap: Record<string, string> = {
      'URGENT': 'bg-red-100 text-red-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'LOW': 'bg-green-100 text-green-800'
    };
    return priorityMap[priority] || 'bg-gray-100 text-gray-800';
  }
}