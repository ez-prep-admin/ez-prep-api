import {
  Controller,
  Get,
  Header,
  Param,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CommerceEnabledGuard } from '../commerce/commerce-enabled.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { InvoiceService } from './invoice.service';

@ApiTags('me-invoices')
@Controller('me/invoices')
@UseGuards(CommerceEnabledGuard, JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class MeInvoicesController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @ApiOperation({ summary: 'List my tax invoices' })
  async listMine(@GetUser() user: UserResponseDto) {
    const data = await this.invoiceService.listForUser(user.id);
    return {
      message: 'Invoices retrieved successfully',
      data,
    };
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download my tax invoice PDF' })
  @ApiOkResponse({ description: 'PDF bytes' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  async downloadPdf(
    @Param('id') id: string,
    @GetUser() user: UserResponseDto,
  ): Promise<StreamableFile> {
    const file = await this.invoiceService.downloadForUser(id, user.id);
    return new StreamableFile(file.body, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
}
