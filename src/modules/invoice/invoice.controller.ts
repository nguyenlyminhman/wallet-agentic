import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EApiPath, VERSION_1 } from 'src/objects/enum/EApiPath.enum';


@ApiTags('Invoice')
@Controller({ path: EApiPath.INVOICE, version: VERSION_1 })
export class InvoiceController {



}
