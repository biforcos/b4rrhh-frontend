import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { EmployeeAddressSectionComponent } from '../components/employee-address-section.component';
import { EmployeeContactSectionComponent } from '../components/employee-contact-section.component';
import { EmployeeIdentifierSectionComponent } from '../components/employee-identifier-section.component';
import { EmployeeAddressStore } from '../../data-access/employee-address.store';
import { EmployeeContactStore } from '../../data-access/employee-contact.store';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeIdentifierStore } from '../../data-access/employee-identifier.store';
import { employeeTexts } from '../../employee.texts';
import { GlobalUiMessage } from '../../models/global-ui-message.model';
import { readEmployeeBusinessKeyFromParamMap } from '../../routing/employee-route-key.util';

@Component({
  selector: 'app-employee-contact-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeeContactSectionComponent,
    EmployeeAddressSectionComponent,
    EmployeeIdentifierSectionComponent,
  ],
  templateUrl: './employee-contact-page.component.html',
  styleUrl: './employee-contact-page.component.scss',
})
export class EmployeeContactPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly employeeAddressStore = inject(EmployeeAddressStore);
  private readonly employeeContactStore = inject(EmployeeContactStore);
  private readonly employeeIdentifierStore = inject(EmployeeIdentifierStore);
  private readonly globalMessageService = inject(GlobalMessageService);
  private previousContactSuccess: 'created' | 'updated' | 'deleted' | null = null;
  private previousAddressSuccess: 'created' | 'updated' | 'closed' | null = null;
  private previousIdentifierSuccess: 'created' | 'updated' | 'deleted' | null = null;

  protected readonly texts = employeeTexts;
  protected readonly activeEmployeeKey = toSignal(
    this.route.paramMap.pipe(map((params) => readEmployeeBusinessKeyFromParamMap(params))),
    {
      initialValue: readEmployeeBusinessKeyFromParamMap(this.route.snapshot.paramMap),
    },
  );
  protected readonly contacts = this.employeeContactStore.contacts;
  protected readonly loadingContacts = this.employeeContactStore.loading;
  protected readonly contactsError = this.employeeContactStore.error;
  protected readonly loadingAddresses = this.employeeAddressStore.loading;
  protected readonly addressesError = this.employeeAddressStore.error;
  protected readonly loadingIdentifiers = this.employeeIdentifierStore.loading;
  protected readonly identifiersError = this.employeeIdentifierStore.error;
  protected readonly loadingPersonals = computed(
    () => this.loadingContacts() || this.loadingAddresses() || this.loadingIdentifiers(),
  );

  constructor() {
    effect((onCleanup) => {
      const messages = this.buildGlobalMessages();
      untracked(() => {
        this.globalMessageService.setSourceMessages('employee-contact-page', messages);
      });
      onCleanup(() => {
        untracked(() => this.globalMessageService.clearSourceMessages('employee-contact-page'));
      });
    });

    effect(() => {
      this.publishSuccessFeedback();
    });
  }

  private buildGlobalMessages(): ReadonlyArray<Omit<GlobalUiMessage, 'createdAt'>> {
    const messages: Array<Omit<GlobalUiMessage, 'createdAt'>> = [];

    const contactErrorMessage = this.employeeContactStore.errorMessage()?.trim();
    if (contactErrorMessage) {
      messages.push({
        id: 'contact-operation-error',
        level: 'error',
        text: contactErrorMessage,
        sectionId: 'contact',
        sectionLabel: this.texts.personalAreaLabel,
        sticky: true,
      });
    } else if (this.contactsError() === 'request-failed') {
      messages.push({
        id: 'contact-load-error',
        level: 'error',
        text: this.texts.contactLoadFailedMessage,
        sectionId: 'contact',
        sectionLabel: this.texts.personalAreaLabel,
        sticky: true,
      });
    }

    if (this.addressesError() === 'request-failed') {
      messages.push({
        id: 'address-error',
        level: 'error',
        text: this.texts.addressesSectionRequestFailedMessage,
        sectionId: 'contact',
        sectionLabel: this.texts.personalAreaLabel,
        sticky: true,
      });
    }

    if (this.identifiersError() === 'request-failed') {
      messages.push({
        id: 'identifier-error',
        level: 'error',
        text: this.texts.identifiersSectionRequestFailedMessage,
        sectionId: 'contact',
        sectionLabel: this.texts.personalAreaLabel,
        sticky: true,
      });
    }

    return messages;
  }

  private publishSuccessFeedback(): void {
    const contactSuccess = this.employeeContactStore.success();
    if (contactSuccess && contactSuccess !== this.previousContactSuccess) {
      this.publishTransientSuccess(
        `contact-${contactSuccess}`,
        this.mapContactSuccessMessage(contactSuccess),
      );
    }
    this.previousContactSuccess = contactSuccess;

    const addressSuccess = this.employeeAddressStore.success();
    if (addressSuccess && addressSuccess !== this.previousAddressSuccess) {
      this.publishTransientSuccess(
        `address-${addressSuccess}`,
        this.mapAddressSuccessMessage(addressSuccess),
      );
    }
    this.previousAddressSuccess = addressSuccess;

    const identifierSuccess = this.employeeIdentifierStore.success();
    if (identifierSuccess && identifierSuccess !== this.previousIdentifierSuccess) {
      this.publishTransientSuccess(
        `identifier-${identifierSuccess}`,
        this.mapIdentifierSuccessMessage(identifierSuccess),
      );
    }
    this.previousIdentifierSuccess = identifierSuccess;
  }

  private publishTransientSuccess(idSuffix: string, text: string | null): void {
    if (!text) {
      return;
    }

    untracked(() => {
      this.globalMessageService.success(text, {
        id: `employee-contact-page-success-${idSuffix}`,
        sectionId: 'contact',
        sectionLabel: this.texts.personalAreaLabel,
      });
    });
  }

  private mapContactSuccessMessage(success: 'created' | 'updated' | 'deleted'): string {
    if (success === 'created') {
      return this.texts.contactsSectionCreateSuccessMessage;
    }

    if (success === 'updated') {
      return this.texts.contactsSectionEditSuccessMessage;
    }

    return this.texts.contactsSectionDeleteSuccessMessage;
  }

  private mapAddressSuccessMessage(success: 'created' | 'updated' | 'closed'): string {
    if (success === 'created') {
      return this.texts.addressesSectionCreateSuccessMessage;
    }

    if (success === 'updated') {
      return this.texts.addressesSectionEditCurrentSuccessMessage;
    }

    return this.texts.addressesSectionCloseSuccessMessage;
  }

  private mapIdentifierSuccessMessage(success: 'created' | 'updated' | 'deleted'): string {
    if (success === 'created') {
      return this.texts.identifiersSectionCreateSuccessMessage;
    }

    if (success === 'updated') {
      return this.texts.identifiersSectionEditSuccessMessage;
    }

    return this.texts.identifiersSectionDeleteSuccessMessage;
  }
}
