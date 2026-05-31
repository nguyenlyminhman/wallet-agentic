import { BadRequestException, Controller, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { EApiPath, VERSION_1 } from 'src/objects/enum/EApiPath.enum';
import { memoryStorage } from 'multer';
import { InvoiceService } from './invoice.service';
import { InvoiceResultDto } from './dto/invoice-result.dto';



@ApiTags('Invoice')
@Controller({ path: EApiPath.INVOICE, version: VERSION_1 })
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) { }

    @Post('/upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadInvoice(@UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('File is required');

        let tada: InvoiceResultDto;
        try {
            console.log('file path: ', file.path)
            tada = await this.invoiceService.processUploadedInvoice(file);

        } catch (error: any) {
            console.log(error.message)
            throw new BadRequestException('Invalid JSON file');
        }

        return { result: tada, msg: 'Success', 'status': HttpStatus.OK };
    }


}
