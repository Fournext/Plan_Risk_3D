import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StructuralAnalysisService {
  private http = inject(HttpClient);
  private API = environment.endpoint;
  public isLoading = signal<boolean>(false);

  getStructuralAnalysis(file:File): Observable<any> {
    const formData = new FormData();
    formData.append('archivo', file);
    return this.http.post<any>(`${this.API}api/suggestion_risk/analizar/`, formData);
  }
}
