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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { InvoiceService } from './invoice.service';

@ApiTags('admin-invoices')
@Controller('admin/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminInvoicesController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @ApiOperation({ summary: 'List tax invoices (Admin)' })
  async list() {
    const data = await this.invoiceService.listForAdmin();
    return {
      message: 'Invoices retrieved successfully',
      data,
    };
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download a tax invoice PDF (Admin)' })
  @ApiOkResponse({ description: 'PDF bytes' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  async downloadPdf(@Param('id') id: string): Promise<StreamableFile> {
    const file = await this.invoiceService.downloadForAdmin(id);
    return new StreamableFile(file.body, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
}
