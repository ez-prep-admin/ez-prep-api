/* eslint-disable prettier/prettier */
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly msg91ApiUrl =
    'https://control.msg91.com/api/v5/widget/verifyAccessToken';
  private readonly authKey: string;

  constructor(private configService: ConfigService) {
    this.authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    if (!this.authKey) {
      this.logger.error('MSG91_AUTH_KEY is not configured');
      throw new Error('MSG91_AUTH_KEY is required');
    }
  }

  /**
   * Verify the access token received from MSG91 OTP widget
   * @param accessToken - JWT token received from MSG91 widget after OTP verification
   * @returns Promise<string> - Returns the verified phone number
   * @throws HttpException - Throws exception if token verification fails
   */
  async verifyAccessToken(accessToken: string): Promise<string> {
    try {
      this.logger.log('Verifying access token with MSG91...');

      const response = await fetch(this.msg91ApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authkey: this.authKey,
          'access-token': accessToken,
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `MSG91 API request failed with status: ${response.status}`,
        );
        throw new HttpException(
          'Failed to verify access token with MSG91',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const responseText = await response.text();
      this.logger.log(`MSG91 API raw response: ${responseText}`);

      // Try to parse as JSON first
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        // If parsing fails, treat the response as a plain phone number string
        this.logger.log('Response is not JSON, treating as phone number');
        data = responseText;
      }

      let phoneNumber: string;

      // Handle different response formats from MSG91
      if (typeof data === 'string') {
        // Response is directly the phone number
        phoneNumber = data.trim();
        this.logger.log(`Phone number received directly: ${phoneNumber}`);
      } else if (data && data.type === 'success' && data.data?.mobile) {
        // Response is JSON with success structure and data.mobile
        phoneNumber = data.data.mobile;
        this.logger.log(`Phone number from JSON response: ${phoneNumber}`);
      } else if (data && data.type === 'success' && data.message) {
        // Response is JSON with success type and phone number in message field
        phoneNumber = data.message;
        this.logger.log(`Phone number from message field: ${phoneNumber}`);
      } else if (data && data.mobile) {
        // Response is JSON but phone is directly in mobile field
        phoneNumber = data.mobile;
        this.logger.log(`Phone number from mobile field: ${phoneNumber}`);
      } else {
        // Invalid response format
        this.logger.warn(
          'MSG91 token verification failed - invalid response format:',
          responseText,
        );
        throw new HttpException(
          'Invalid or expired access token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Validate phone number
      if (!phoneNumber || phoneNumber.length < 10) {
        this.logger.warn(
          'Invalid phone number received from MSG91:',
          phoneNumber,
        );
        throw new HttpException(
          'Invalid phone number received',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Ensure phone number starts with + for consistency
      const formattedPhone = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+${phoneNumber}`;

      this.logger.log(
        `Access token verified successfully for phone: ${formattedPhone}`,
      );
      return formattedPhone;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Unexpected error during MSG91 token verification:',
        error.message,
      );
      throw new HttpException(
        'Failed to verify access token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Format phone number to ensure consistency
   * @param phone - Phone number to format
   * @returns Formatted phone number with country code
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with + if it doesn't already
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }
}
