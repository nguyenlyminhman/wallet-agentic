import { BadRequestException, Controller, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { EApiPath, VERSION_1 } from 'src/objects/enum/EApiPath.enum';
import { memoryStorage } from 'multer';



@ApiTags('Invoice')
@Controller({ path: EApiPath.INVOICE, version: VERSION_1 })
export class InvoiceController {
    constructor() { }

    @Post('/upload')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            fileFilter: (req, file, callback) => {
                if (!file.originalname.endsWith('.pdf')) {
                    return callback(
                        new BadRequestException('Only pdf file allowed'),
                        false,
                    );
                }
                callback(null, true);
            },
        }),
    )
    async importRepo( @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) { throw new BadRequestException('File is required'); }
        const jsonString = file.buffer.toString('utf-8');

        let payload: any[];

        try {
            payload = JSON.parse(jsonString);
        } catch (error) {
            throw new BadRequestException('Invalid JSON file');
        }

        // const rs = await this.repoService.importRepo(payload, email);

        return {result: 'rs', msg: 'Success', 'status':  HttpStatus.OK};
    }


}
