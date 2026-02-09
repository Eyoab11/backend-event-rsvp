import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google } from 'googleapis';
import { Attendee, PlusOne } from '@prisma/client';

@Injectable()
export class SheetsService implements OnModuleInit {
  private readonly logger = new Logger(SheetsService.name);
  private sheets;
  private auth;
  private isConfigured = false;

  constructor() {
    this.initializeAuth();
  }

  async onModuleInit() {
    // Initialize sheet structure when module starts
    if (this.isConfigured) {
      await this.initializeSheet();
    }
  }

  private async initializeAuth() {
    try {
      // Check for webhook URL first (easiest method)
      const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      
      if (webhookUrl) {
        this.logger.log('✅ Using Google Sheets webhook (Apps Script)');
        this.isConfigured = true;
        return;
      }

      // Fallback to service account method
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      
      if (!spreadsheetId) {
        this.logger.warn('Google Sheets not configured. Sync disabled.');
        this.logger.warn('Set GOOGLE_SHEETS_WEBHOOK_URL for easy setup (see GOOGLE_SHEETS_ALTERNATIVE_SOLUTIONS.md)');
        return;
      }

      // Initialize auth with service account (JSON string or file path)
      let credentials = null;

      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        // Option 1: Service account JSON as string
        try {
          credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
          this.logger.log('Using Service Account credentials from GOOGLE_SERVICE_ACCOUNT_KEY');
        } catch (parseError) {
          this.logger.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY. Make sure it\'s valid JSON.');
          return;
        }
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_PATH) {
        // Option 2: Service account JSON file path
        this.logger.log(`Using Service Account credentials from file: ${process.env.GOOGLE_SERVICE_ACCOUNT_PATH}`);
        this.auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      } else {
        this.logger.error('❌ Google Sheets credentials not configured!');
        this.logger.error('   Recommended: Set GOOGLE_SHEETS_WEBHOOK_URL (easiest, no auth needed)');
        this.logger.error('   Alternative: Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_PATH');
        this.logger.error('   See GOOGLE_SHEETS_ALTERNATIVE_SOLUTIONS.md for setup instructions');
        return;
      }

      // If we have credentials object, create auth from it
      if (credentials) {
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      }

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.isConfigured = true;
      this.logger.log('✅ Google Sheets service initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Google Sheets auth:', error.message);
      this.isConfigured = false;
    }
  }

  async addAttendeeToSheet(
    attendee: Attendee,
    plusOne?: PlusOne,
    eventName?: string,
  ): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn('Google Sheets not configured, skipping sync');
      return;
    }

    try {
      // Check if using webhook method (Apps Script)
      const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      
      if (webhookUrl) {
        await this.syncViaWebhook(webhookUrl, attendee, plusOne, eventName);
        return;
      }

      // Fallback to direct API method
      await this.syncViaAPI(attendee, plusOne, eventName);
    } catch (error) {
      this.logger.error(`Failed to sync attendee to Google Sheets: ${error.message}`, error.stack);
      // Don't throw - we don't want to fail registration if sheets sync fails
    }
  }

  private async syncViaWebhook(
    webhookUrl: string,
    attendee: Attendee,
    plusOne?: PlusOne,
    eventName?: string,
  ): Promise<void> {
    this.logger.log(`Syncing attendee ${attendee.name} via webhook`);

    const payload = {
      attendee: {
        registrationDate: new Date().toISOString(),
        name: attendee.name,
        email: attendee.email,
        company: attendee.company,
        title: attendee.title,
        status: attendee.status,
        registrationId: attendee.registrationId,
        eventName: eventName || '',
        hasPlusOne: !!plusOne,
      },
      plusOne: plusOne ? {
        registrationDate: new Date().toISOString(),
        name: plusOne.name,
        email: plusOne.email,
        company: plusOne.company,
        title: plusOne.title,
        registrationId: (plusOne as any).registrationId || `${attendee.registrationId}-P1`,
        eventName: eventName || '',
      } : null,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      this.logger.log(`✅ Successfully synced attendee ${attendee.id} via webhook`);
      if (plusOne) {
        this.logger.log(`✅ Successfully synced plus-one ${plusOne.id} via webhook`);
      }
    } else {
      throw new Error(result.error || 'Unknown webhook error');
    }
  }

  private async syncViaAPI(
    attendee: Attendee,
    plusOne?: PlusOne,
    eventName?: string,
  ): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId || !this.sheets) {
      this.logger.warn('Google Sheets API not configured');
      return;
    }

    // Prepare attendee row
    const attendeeRow = [
      new Date().toISOString(),
      attendee.name,
      attendee.email,
      attendee.company,
      attendee.title,
      attendee.status,
      attendee.registrationId,
      eventName || '',
      plusOne ? 'Yes' : 'No',
      'No', // Checked in status - will be updated when check-in feature is used
    ];

    this.logger.log(`Syncing attendee ${attendee.name} to Google Sheets`);

    // Append to sheet
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Attendees!A:J',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [attendeeRow],
      },
    });

    this.logger.log(`Successfully synced attendee ${attendee.id} to Google Sheets`);

    // If there's a plus one, add them too
    if (plusOne) {
      const plusOneRow = [
        new Date().toISOString(),
        plusOne.name,
        plusOne.email,
        plusOne.company,
        plusOne.title,
        'PLUS_ONE',
        (plusOne as any).registrationId || `${attendee.registrationId}-P1`,
        eventName || '',
        'N/A',
        'No',
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Attendees!A:J',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [plusOneRow],
        },
      });

      this.logger.log(`Successfully synced plus-one ${plusOne.id} to Google Sheets`);
    }
  }

  async initializeSheet(): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId || !this.sheets || !this.isConfigured) {
      this.logger.warn('Google Sheets not configured');
      return;
    }

    try {
      this.logger.log('Checking if Attendees sheet exists...');
      
      // Check if Attendees sheet exists
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      });

      const attendeesSheet = response.data.sheets?.find(
        (sheet) => sheet.properties?.title === 'Attendees',
      );

      if (!attendeesSheet) {
        this.logger.log('Attendees sheet not found, creating it...');
        
        // Create Attendees sheet with headers
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Attendees',
                  },
                },
              },
            ],
          },
        });

        this.logger.log('Attendees sheet created, adding headers...');

        // Add headers
        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Attendees!A1:J1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              [
                'Registration Date',
                'Name',
                'Email',
                'Company',
                'Title',
                'Status',
                'Registration ID',
                'Event',
                'Has Plus One',
                'Checked In',
              ],
            ],
          },
        });

        this.logger.log('Attendees sheet initialized successfully with headers');
      } else {
        this.logger.log('Attendees sheet already exists');
      }
    } catch (error) {
      this.logger.error(`Failed to initialize Google Sheets: ${error.message}`, error.stack);
    }
  }

  getSheetUrl(): string | null {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    return spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      : null;
  }
}
