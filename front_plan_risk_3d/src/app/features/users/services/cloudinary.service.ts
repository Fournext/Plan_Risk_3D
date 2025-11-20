import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { Cloudinary } from '../../../models/interfaces/cloudinary/cloudinary.interface';

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private uploadPreset: string = 'profiles';
  private cloudName: string = 'diqqfka6g';
  public isLoading = signal<boolean>(false);
  //dependencies would go here
  private http = inject(HttpClient);
  private API = environment.cloudinary

  uploadImage(imageProfile: File): Observable<Cloudinary> {
    // Crear el FormData
    const formData: FormData = new FormData();
    formData.append('file', imageProfile);
    formData.append('upload_preset', this.uploadPreset);

    // Realizar la solicitud POST a Cloudinary
    return this.http.post<any>(`${this.API}/${this.cloudName}/image/upload`, formData).pipe(
      tap(response => {
        console.log('Imagen subida con éxito:', response);
      }),
      catchError(error => {
        console.error('Error al subir la imagen:', error);
        return throwError(() => new Error('Error al subir la imagen a Cloudinary'));
      })
    );

  }


  constructor() { }

}
