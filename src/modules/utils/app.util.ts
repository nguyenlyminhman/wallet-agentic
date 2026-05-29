
export class AppUtil {


    static slash(path: string) {
        const isExtendedLengthPath = path.startsWith('\\\\?\\');

        if (isExtendedLengthPath) {
            return path;
        }

        return path.replace(/\\/g, '/');
    }

    static parseInt(value: string, fallCallback: number) {
        try {
            const number = Number.parseInt(value);
            if (Number.isNaN(number)) return fallCallback;
            else return number;
        } catch (e) {
            return fallCallback;
        }
    }

    static toLowerCaseNonAccentVietnamese(str: string) {
        try {
            str = str.toLowerCase();
            str = str.replace(/–/g, '-');
            str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
            str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
            str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
            str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
            str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
            str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
            str = str.replace(/đ/g, 'd');
            // Some system encode vietnamese combining accent as individual utf-8 characters
            str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ''); // Huyền sắc hỏi ngã nặng
            str = str.replace(/\u02C6|\u0306|\u031B/g, ''); // Â, Ê, Ă, Ơ, Ư
            return str;
        } catch (e) {
            return str;
        }
    }

    static slugEncode = (st: string) => {
        try {
            const value = AppUtil.toLowerCaseNonAccentVietnamese(st)
                .replace(
                    /(~|`|!|@|#|$|%|^|&|\*|\(|\)|{|}|\[|\]|;|:|\"|'|<|,|\.|>|\?|\/|\\|\||\+|=|–|“|”)/g,
                    '',
                )
                ?.replace(/^[A-Z _]*[A-Z][A-Z _]*$/g, '')
                .replace(/ /g, '-');
            return encodeURIComponent(value);
        } catch (e) {
            console.log(e);
            return st;
        }
    };


    static isVietnamese = (text: string) => {
        if (!text || typeof text !== "string") {
            return false;
        }

        const vietnameseRegex =
            /^[a-zA-Z0-9ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s.,!?;:'"()\-]+$/;

        return vietnameseRegex.test(text.trim());
    };
}
