import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

import { EmployeePhotoService } from '../data-access/employee-photo.service';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { describeFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';

@Component({
  selector: 'app-employee-photo-upload-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule, ProgressSpinnerModule, ImageCropperComponent],
  templateUrl: './employee-photo-upload-dialog.component.html',
  styleUrl: './employee-photo-upload-dialog.component.scss',
})
export class EmployeePhotoUploadDialogComponent {
  readonly employeeKey = input.required<EmployeeBusinessKey>();
  readonly visible = model(false);
  readonly photoConfirmed = output<string>();

  protected readonly imageChangedEvent = signal<Event | null>(null);
  protected readonly croppedBlob = signal<Blob | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly fileTooBig = signal(false);

  private readonly photoService = inject(EmployeePhotoService);

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.fileTooBig.set(false);
    this.uploadError.set(null);

    if (file.size > 5 * 1024 * 1024) {
      this.fileTooBig.set(true);
      return;
    }

    this.imageChangedEvent.set(event);
  }

  protected onImageCropped(event: ImageCroppedEvent): void {
    this.croppedBlob.set(event.blob ?? null);
  }

  protected upload(): void {
    const blob = this.croppedBlob();
    if (!blob || this.uploading()) return;

    this.uploading.set(true);
    this.uploadError.set(null);

    this.photoService.uploadPhoto(this.employeeKey(), blob).subscribe({
      next: (employee) => {
        this.uploading.set(false);
        this.visible.set(false);
        this.imageChangedEvent.set(null);
        this.croppedBlob.set(null);
        this.photoConfirmed.emit(employee.photoUrl ?? '');
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.uploadError.set(describeFailure('No se pudo subir la foto', toHttpFailure(err)));
      },
    });
  }

  protected cancel(): void {
    this.imageChangedEvent.set(null);
    this.croppedBlob.set(null);
    this.uploadError.set(null);
    this.visible.set(false);
  }
}
