import { inject, Injectable, signal } from '@angular/core';
import { env } from 'process';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { ResponseBlockchain, VerifyPlan } from '../../../models/interfaces/blockchain/blockchain.interface';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BlockchainService {
  private API = environment.endpoint;
  private http = inject(HttpClient);

  //objeto a verificar 
  public imageToVerify = signal<VerifyPlan>({
    id: 0,
    url: ''
  });


  //para verificar la imagen vamos a necesitar el archivo file
  verifyImagen(image: File, id: number, json: File, model: File): Observable<ResponseBlockchain> {
    const formData = new FormData();
    formData.append('job_id', id.toString());
    formData.append('json_file', json);
    formData.append('model_file', model);
    formData.append('img_file', image);

    return this.http.post<ResponseBlockchain>(`${this.API}api/set_plan/validar_plano/`, formData).pipe(
      tap(response => {
        console.log({ response });
      })
    );
  }
  constructor() { }

}
